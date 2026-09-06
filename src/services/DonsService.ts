import { Don, DONATEUR_ANONYME_ID } from '../types/association';
import { newEntityId, parseDateOrNow } from '../utils/invoiceFormat';
import { Db } from './db';
import { withLog } from './logger';

function reviveDon(raw: Partial<Don>): Don {
  return {
    ...(raw as Don),
    id: raw.id || newEntityId('don'),
    date: parseDateOrNow(raw.date),
    datePerception: raw.datePerception ? parseDateOrNow(raw.datePerception) : undefined,
    createdAt: parseDateOrNow(raw.createdAt),
    updatedAt: parseDateOrNow(raw.updatedAt),
  };
}

export const DonsService = {
  async loadDons(): Promise<Don[]> {
    return withLog('DonsService.loadDons', async () => {
      const rows = await Db.select<{ payload: string }>('SELECT payload FROM dons_manuels');
      return rows.map((r) => reviveDon(JSON.parse(r.payload)));
    });
  },

  async upsertDon(don: Don): Promise<Don> {
    return withLog('DonsService.upsertDon', async () => {
      const now = new Date();
      const normalized: Don = {
        ...don,
        id: don.id || newEntityId('don'),
        createdAt: don.createdAt || now,
        updatedAt: now,
      };
      await Db.execute(
        `INSERT INTO dons_manuels (id, donateur_id, payload) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET donateur_id = excluded.donateur_id, payload = excluded.payload`,
        [
          normalized.id,
          normalized.donateurId,
          JSON.stringify({
            ...normalized,
            date: normalized.date.toISOString(),
            datePerception: normalized.datePerception?.toISOString(),
            createdAt: normalized.createdAt.toISOString(),
            updatedAt: normalized.updatedAt.toISOString(),
          }),
        ]
      );
      return normalized;
    });
  },

  async deleteDon(donId: string): Promise<void> {
    await Db.execute('DELETE FROM dons_manuels WHERE id = ?', [donId]);
  },

  async getDonsByDonateur(donateurId: string): Promise<Don[]> {
    const dons = await this.loadDons();
    return dons.filter((d) => d.donateurId === donateurId);
  },

  async importList(raw: unknown[]): Promise<void> {
    if (!Array.isArray(raw)) return;
    for (const item of raw) {
      await this.upsertDon(reviveDon(item as Partial<Don>));
    }
  },

  ANOYME: DONATEUR_ANONYME_ID,
};
