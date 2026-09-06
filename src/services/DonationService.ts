import i18n from '../i18n/config';
import { Donation, DonationRule, ModeVersement, NatureDon } from '../types/association';
import { Client } from '../types/invoice';
import { newEntityId } from '../utils/invoiceFormat';
import { ClientService } from './ClientService';
import { Db } from './db';
import { withLog } from './logger';
import { sqlTxActive } from '../utils/sqlTx';

export interface DonationTransaction {
  id: string;
  date: string;
  label: string;
  credit: number;
  categoryCode: string | null;
  accountName: string;
  donationId: string | null;
  contactId: string | null;
}

export interface DonationSummary {
  count: number;
  total: number;
  anonymousTotal: number;
  natureTotal: number;
  receiptsPending: number;
}

const nowIso = () => new Date().toISOString();

function donationFromRow(row: Record<string, unknown>): Donation {
  return {
    id: String(row.id),
    contactId: row.contact_id ? String(row.contact_id) : null,
    anonymous: Number(row.anonymous) === 1,
    donorLabel: row.donor_label ? String(row.donor_label) : undefined,
    source: String(row.source) as Donation['source'],
    transactionId: row.transaction_id ? String(row.transaction_id) : undefined,
    natureDon: String(row.nature) as NatureDon,
    modeVersement: row.payment_method ? String(row.payment_method) as ModeVersement : undefined,
    montant: Number(row.amount),
    date: String(row.donation_date),
    datePerception: row.received_date ? String(row.received_date) : undefined,
    description: row.description ? String(row.description) : undefined,
    valuationMethod: row.valuation_method ? String(row.valuation_method) : undefined,
    valuationProvidedByDonor: Number(row.valuation_by_donor) === 1,
    notes: row.notes ? String(row.notes) : undefined,
    receiptEligible: Number(row.receipt_eligible) === 1,
    receiptId: row.receipt_id ? String(row.receipt_id) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export const DonationService = {
  async listDonors(): Promise<Client[]> {
    const contacts = await ClientService.loadClients();
    return contacts.filter((contact) => contact.roles?.includes('donateur'));
  },

  /** Ajoute le rôle donateur au contact s’il ne l’a pas encore. */
  async ensureDonorRole(contactId: string): Promise<Client> {
    return withLog('DonationService.ensureDonorRole', async () => {
      const contact = await ClientService.getClientById(contactId);
      if (!contact) throw new Error(i18n.t('errors.contactNotFound'));
      if (contact.roles?.includes('donateur')) return contact;
      return ClientService.upsertClient({
        ...contact,
        roles: Array.from(new Set([...(contact.roles ?? ['client']), 'donateur'])),
      });
    });
  },

  async listByContact(contactId: string): Promise<Donation[]> {
    const rows = await Db.select<Record<string, unknown>>(
      `SELECT * FROM donations WHERE contact_id = ?
       ORDER BY donation_date DESC, created_at DESC`,
      [contactId]
    );
    return rows.map(donationFromRow);
  },

  async list(start?: string, end?: string): Promise<Donation[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (start) {
      conditions.push('donation_date >= ?');
      params.push(start);
    }
    if (end) {
      conditions.push('donation_date <= ?');
      params.push(end);
    }
    const rows = await Db.select<Record<string, unknown>>(
      `SELECT * FROM donations${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY donation_date DESC, created_at DESC`,
      params
    );
    return rows.map(donationFromRow);
  },

  async getById(id: string): Promise<Donation | null> {
    const rows = await Db.select<Record<string, unknown>>(
      'SELECT * FROM donations WHERE id = ?',
      [id]
    );
    return rows[0] ? donationFromRow(rows[0]) : null;
  },

  async save(input: Partial<Donation> & Pick<Donation, 'natureDon' | 'montant' | 'date'>): Promise<Donation> {
    return withLog('DonationService.save', async () => {
      if (input.montant <= 0) throw new Error(i18n.t('errors.amountPositive'));
      if (!input.contactId && !input.anonymous) throw new Error(i18n.t('errors.chooseDonorOrAnonymous'));
      if (input.natureDon !== 'numeraire' && !input.description?.trim()) {
        throw new Error(i18n.t('errors.natureDescriptionRequired'));
      }
      const existing = input.id ? await this.getById(input.id) : null;
      if (existing?.receiptId) {
        if (
          input.montant !== existing.montant
          || (input.contactId ?? null) !== existing.contactId
          || Boolean(input.anonymous) !== existing.anonymous
        ) {
          throw new Error(i18n.t('errors.donationLockedByReceipt'));
        }
      }
      const now = nowIso();
      const donation: Donation = {
        id: input.id || newEntityId('don'),
        contactId: existing?.receiptId
          ? existing.contactId
          : (input.anonymous ? null : input.contactId ?? null),
        anonymous: existing?.receiptId ? existing.anonymous : Boolean(input.anonymous),
        donorLabel: input.donorLabel?.trim() || undefined,
        source: input.source ?? existing?.source ?? 'manuel',
        transactionId: input.transactionId ?? existing?.transactionId,
        natureDon: input.natureDon,
        modeVersement: input.natureDon === 'numeraire' ? input.modeVersement : undefined,
        montant: existing?.receiptId ? existing.montant : input.montant,
        date: input.date,
        datePerception: input.datePerception,
        description: input.description?.trim() || undefined,
        valuationMethod: input.valuationMethod?.trim() || undefined,
        valuationProvidedByDonor: input.natureDon === 'numeraire'
          ? undefined
          : Boolean(input.valuationProvidedByDonor),
        notes: input.notes?.trim() || undefined,
        receiptEligible: existing?.receiptId
          ? existing.receiptEligible
          : (input.anonymous ? false : input.receiptEligible !== false),
        receiptId: existing?.receiptId ?? input.receiptId,
        createdAt: input.createdAt || existing?.createdAt || now,
        updatedAt: now,
      };
      await Db.execute(
        `INSERT INTO donations
          (id, contact_id, anonymous, donor_label, source, transaction_id, nature,
           payment_method, amount, donation_date, received_date, description,
           valuation_method, valuation_by_donor, notes, receipt_eligible, receipt_id,
           created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           contact_id=excluded.contact_id, anonymous=excluded.anonymous,
           donor_label=excluded.donor_label, source=excluded.source,
           transaction_id=excluded.transaction_id, nature=excluded.nature,
           payment_method=excluded.payment_method, amount=excluded.amount,
           donation_date=excluded.donation_date, received_date=excluded.received_date,
           description=excluded.description, valuation_method=excluded.valuation_method,
           valuation_by_donor=excluded.valuation_by_donor, notes=excluded.notes,
           receipt_eligible=excluded.receipt_eligible, receipt_id=COALESCE(donations.receipt_id, excluded.receipt_id),
           updated_at=excluded.updated_at`,
        [
          donation.id, donation.contactId, donation.anonymous ? 1 : 0, donation.donorLabel ?? null,
          donation.source, donation.transactionId ?? null, donation.natureDon,
          donation.modeVersement ?? null, donation.montant, donation.date,
          donation.datePerception ?? null, donation.description ?? null,
          donation.valuationMethod ?? null, donation.valuationProvidedByDonor ? 1 : 0,
          donation.notes ?? null, donation.receiptEligible ? 1 : 0, donation.receiptId ?? null,
          donation.createdAt, donation.updatedAt,
        ]
      );
      return donation;
    });
  },

  async remove(id: string): Promise<void> {
    await Db.execute('DELETE FROM donations WHERE id = ? AND receipt_id IS NULL', [id]);
  },

  async listIncomingTransactions(): Promise<DonationTransaction[]> {
    const rows = await Db.select<Record<string, unknown>>(
      `SELECT CAST(t.id AS TEXT) id, t.date, t.label, t.credit, t.category_code,
              a.name account_name, d.id donation_id, d.contact_id
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       LEFT JOIN donations d ON d.transaction_id = CAST(t.id AS TEXT)
       WHERE t.credit > 0 AND ${sqlTxActive('t')}
       ORDER BY t.date DESC, t.id DESC`
    );
    return rows.map((row) => ({
      id: String(row.id),
      date: String(row.date),
      label: String(row.label),
      credit: Number(row.credit),
      categoryCode: row.category_code ? String(row.category_code) : null,
      accountName: String(row.account_name),
      donationId: row.donation_id ? String(row.donation_id) : null,
      contactId: row.contact_id ? String(row.contact_id) : null,
    }));
  },

  async linkTransaction(transaction: DonationTransaction, contactId: string): Promise<Donation> {
    return withLog('DonationService.linkTransaction', async () => {
      await this.ensureDonorRole(contactId);
      return this.save({
        id: transaction.donationId || newEntityId('dontx'),
        contactId,
        anonymous: false,
        source: 'transaction',
        transactionId: transaction.id,
        natureDon: 'numeraire',
        modeVersement: 'virement',
        montant: transaction.credit,
        date: transaction.date,
        datePerception: transaction.date,
        description: transaction.label,
        receiptEligible: true,
      });
    });
  },

  async unlinkTransaction(transactionId: string): Promise<void> {
    await Db.execute(
      'DELETE FROM donations WHERE transaction_id = ? AND receipt_id IS NULL',
      [transactionId]
    );
  },

  async listRules(): Promise<DonationRule[]> {
    const rows = await Db.select<Record<string, unknown>>(
      'SELECT * FROM donation_rules ORDER BY created_at DESC'
    );
    return rows.map((row) => ({
      id: String(row.id),
      contactId: String(row.contact_id),
      labelContains: String(row.label_contains),
      categoryCode: row.category_code ? String(row.category_code) : undefined,
      modeVersement: String(row.payment_method) as ModeVersement,
      active: Number(row.active) === 1,
      createdAt: String(row.created_at),
    }));
  },

  async saveRule(rule: Omit<DonationRule, 'id' | 'createdAt' | 'active'>): Promise<DonationRule> {
    return withLog('DonationService.saveRule', async () => {
      const labelContains = rule.labelContains?.trim() ?? '';
      const categoryCode = rule.categoryCode?.trim() || undefined;
      if (!labelContains && !categoryCode) {
        throw new Error(i18n.t('errors.ruleNeedLabelOrCategory'));
      }
      const created: DonationRule = {
        ...rule,
        labelContains,
        categoryCode,
        id: newEntityId('donrule'),
        active: true,
        createdAt: nowIso(),
      };
      await Db.execute(
        `INSERT INTO donation_rules
         (id, contact_id, label_contains, category_code, payment_method, active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [created.id, created.contactId, created.labelContains, created.categoryCode ?? null,
          created.modeVersement, created.createdAt]
      );
      return created;
    });
  },

  async deleteRule(id: string): Promise<void> {
    await Db.execute('DELETE FROM donation_rules WHERE id = ?', [id]);
  },

  /**
   * Lie une catégorie à un contact : crée une règle permanente et rattache
   * immédiatement tous les crédits de cette catégorie non encore corrélés.
   */
  async linkCategoryToContact(categoryCode: string, contactId: string): Promise<number> {
    return withLog('DonationService.linkCategoryToContact', async () => {
      const code = categoryCode.trim();
      if (!code) throw new Error(i18n.t('errors.chooseCategory'));
      if (!contactId) throw new Error(i18n.t('errors.chooseDonorContact'));
      await this.ensureDonorRole(contactId);
      const rules = await this.listRules();
      const already = rules.some(
        (rule) =>
          rule.active
          && rule.contactId === contactId
          && rule.categoryCode === code
          && !rule.labelContains
      );
      if (!already) {
        await this.saveRule({
          contactId,
          labelContains: '',
          categoryCode: code,
          modeVersement: 'virement',
        });
      }
      const transactions = await this.listIncomingTransactions();
      let linked = 0;
      for (const transaction of transactions) {
        if (transaction.donationId) continue;
        if (transaction.categoryCode !== code) continue;
        await this.linkTransaction(transaction, contactId);
        linked += 1;
      }
      return linked;
    });
  },

  async applyRules(): Promise<number> {
    return withLog('DonationService.applyRules', async () => {
      const [rules, transactions] = await Promise.all([this.listRules(), this.listIncomingTransactions()]);
      let linked = 0;
      for (const transaction of transactions.filter((item) => !item.donationId)) {
        const label = transaction.label.toLocaleLowerCase('fr');
        const rule = rules.find((candidate) =>
          candidate.active
          && (!candidate.labelContains || label.includes(candidate.labelContains.toLocaleLowerCase('fr')))
          && (!candidate.categoryCode || candidate.categoryCode === transaction.categoryCode)
        );
        if (!rule) continue;
        await this.linkTransaction(transaction, rule.contactId);
        linked += 1;
      }
      return linked;
    });
  },

  async markReceipt(donationId: string, receiptId: string): Promise<void> {
    await this.markReceipts([donationId], receiptId);
  },

  async markReceipts(donationIds: string[], receiptId: string): Promise<void> {
    if (donationIds.length === 0) return;
    await withLog('DonationService.markReceipts', async () => {
      const placeholders = donationIds.map(() => '?').join(',');
      const existing = await Db.select<{ id: string; receipt_id: string | null }>(
        `SELECT id, receipt_id FROM donations WHERE id IN (${placeholders})`,
        donationIds
      );
      if (existing.some((row) => row.receipt_id)) {
        throw new Error(i18n.t('errors.receiptAlreadyIssued'));
      }
      await Db.execute(
        `UPDATE donations SET receipt_id = ?, updated_at = ? WHERE id IN (${placeholders}) AND receipt_id IS NULL`,
        [receiptId, nowIso(), ...donationIds]
      );
    });
  },

  async summary(start?: string, end?: string): Promise<DonationSummary> {
    const donations = await this.list(start, end);
    return {
      count: donations.length,
      total: donations.reduce((sum, donation) => sum + donation.montant, 0),
      anonymousTotal: donations.filter((donation) => donation.anonymous)
        .reduce((sum, donation) => sum + donation.montant, 0),
      natureTotal: donations.filter((donation) => donation.natureDon !== 'numeraire')
        .reduce((sum, donation) => sum + donation.montant, 0),
      receiptsPending: donations.filter((donation) =>
        donation.receiptEligible && !donation.receiptId
      ).length,
    };
  },
};
