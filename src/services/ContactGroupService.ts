import { ContactGroupe } from '../types/invoice';
import { newEntityId, parseDateOrNow } from '../utils/invoiceFormat';
import { ClientService } from './ClientService';
import { Db } from './db';
import { withLog } from './logger';

function reviveGroupe(raw: Partial<ContactGroupe>): ContactGroupe {
  return {
    id: raw.id || newEntityId('cgrp'),
    nom: (raw.nom ?? '').trim(),
    createdAt: parseDateOrNow(raw.createdAt),
    updatedAt: parseDateOrNow(raw.updatedAt),
  };
}

export const ContactGroupService = {
  async loadGroupes(): Promise<ContactGroupe[]> {
    return withLog('ContactGroupService.loadGroupes', async () => {
      const rows = await Db.select<{ payload: string }>(
        'SELECT payload FROM contact_groups ORDER BY updated_at DESC'
      );
      return rows
        .map((r) => reviveGroupe(JSON.parse(r.payload)))
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    });
  },

  async upsertGroupe(groupe: ContactGroupe): Promise<ContactGroupe> {
    return withLog('ContactGroupService.upsertGroupe', async () => {
      const now = new Date();
      const normalized: ContactGroupe = {
        ...groupe,
        id: groupe.id || newEntityId('cgrp'),
        nom: groupe.nom.trim(),
        createdAt: groupe.createdAt || now,
        updatedAt: now,
      };
      const payload = JSON.stringify({
        ...normalized,
        createdAt: normalized.createdAt.toISOString(),
        updatedAt: normalized.updatedAt.toISOString(),
      });
      await Db.execute(
        `INSERT INTO contact_groups (id, payload, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
        [normalized.id, payload, normalized.updatedAt.toISOString()]
      );
      return normalized;
    });
  },

  async deleteGroupe(groupeId: string): Promise<void> {
    return withLog('ContactGroupService.deleteGroupe', async () => {
      const clients = await ClientService.loadClients();
      for (const client of clients.filter((c) => c.groupeId === groupeId)) {
        await ClientService.upsertClient({ ...client, groupeId: undefined });
      }
      await Db.execute('DELETE FROM contact_groups WHERE id = ?', [groupeId]);
    });
  },
};
