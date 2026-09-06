import {
  Donateur,
  DonateurTransactionMapping,
  DONATEUR_ANONYME_ID,
} from '../types/association';
import { newEntityId, parseDateOrNow, reviveAdresse } from '../utils/invoiceFormat';
import { Db } from './db';
import { StatsService } from './StatsService';
import { withLog } from './logger';

function reviveDonateur(raw: Partial<Donateur>): Donateur {
  return {
    ...(raw as Donateur),
    id: raw.id || newEntityId('donateur'),
    type: raw.type ?? 'particulier',
    adresse: reviveAdresse(raw.adresse),
    createdAt: parseDateOrNow(raw.createdAt),
    updatedAt: parseDateOrNow(raw.updatedAt),
  };
}

export const DonateurService = {
  async loadDonateurs(): Promise<Donateur[]> {
    return withLog('DonateurService.loadDonateurs', async () => {
      const rows = await Db.select<{ payload: string }>(
        'SELECT payload FROM donateurs ORDER BY updated_at DESC'
      );
      return rows.map((r) => reviveDonateur(JSON.parse(r.payload)));
    });
  },

  async upsertDonateur(donateur: Donateur): Promise<Donateur> {
    return withLog('DonateurService.upsertDonateur', async () => {
      const now = new Date();
      const normalized: Donateur = {
        ...donateur,
        id: donateur.id || newEntityId('donateur'),
        createdAt: donateur.createdAt || now,
        updatedAt: now,
      };
      await Db.execute(
        `INSERT INTO donateurs (id, payload, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
        [
          normalized.id,
          JSON.stringify({
            ...normalized,
            createdAt: normalized.createdAt.toISOString(),
            updatedAt: normalized.updatedAt.toISOString(),
          }),
          now.toISOString(),
        ]
      );
      if (normalized.categoryCode) {
        const others = await this.loadDonateurs();
        for (const d of others) {
          if (d.id !== normalized.id && d.categoryCode === normalized.categoryCode) {
            await this.upsertDonateur({ ...d, categoryCode: undefined });
          }
        }
        const txs = await StatsService.listAllTransactions({ categoryCodes: [normalized.categoryCode] });
        for (const t of txs) {
          if (t.credit > 0) {
            await this.linkTransaction(String(t.id), normalized.id);
          }
        }
      }
      return normalized;
    });
  },

  async deleteDonateur(donateurId: string): Promise<void> {
    return withLog('DonateurService.deleteDonateur', async () => {
      await Db.execute('DELETE FROM donateurs WHERE id = ?', [donateurId]);
      await Db.execute('DELETE FROM donateur_transactions WHERE donateur_id = ?', [donateurId]);
    });
  },

  async loadTransactionMapping(): Promise<DonateurTransactionMapping> {
    const rows = await Db.select<{ transaction_id: string; donateur_id: string }>(
      'SELECT transaction_id, donateur_id FROM donateur_transactions'
    );
    const mapping: DonateurTransactionMapping = {};
    for (const row of rows) mapping[row.transaction_id] = row.donateur_id;
    return mapping;
  },

  async linkTransaction(transactionId: string, donateurId: string): Promise<void> {
    await Db.execute(
      `INSERT INTO donateur_transactions (transaction_id, donateur_id) VALUES (?, ?)
       ON CONFLICT(transaction_id) DO UPDATE SET donateur_id = excluded.donateur_id`,
      [transactionId, donateurId]
    );
  },

  async unlinkTransaction(transactionId: string): Promise<void> {
    await Db.execute('DELETE FROM donateur_transactions WHERE transaction_id = ?', [transactionId]);
  },

  async importList(raw: unknown[], mapping?: DonateurTransactionMapping): Promise<void> {
    if (Array.isArray(raw)) {
      for (const item of raw) {
        await this.upsertDonateur(reviveDonateur(item as Partial<Donateur>));
      }
    }
    if (mapping) {
      for (const [txId, donateurId] of Object.entries(mapping)) {
        await this.linkTransaction(txId, donateurId);
      }
    }
  },

  ANOYME: DONATEUR_ANONYME_ID,
};
