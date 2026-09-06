import { ReceiptEntry } from '../types/association';
import { newEntityId } from '../utils/invoiceFormat';
import { AssociationConfigService } from './AssociationConfigService';
import { Db } from './db';
import { withLog } from './logger';

export const RegistreRecusService = {
  async loadRegistre(): Promise<ReceiptEntry[]> {
    return withLog('RegistreRecusService.loadRegistre', async () => {
      const rows = await Db.select<{ payload: string }>('SELECT payload FROM registre_recus');
      return rows
        .map((row) => JSON.parse(row.payload) as ReceiptEntry)
        .sort((a, b) => String(b.dateEmission).localeCompare(String(a.dateEmission))
          || String(b.numero).localeCompare(String(a.numero)));
    });
  },

  async getById(id: string): Promise<ReceiptEntry | null> {
    const rows = await Db.select<{ payload: string }>(
      'SELECT payload FROM registre_recus WHERE id = ?',
      [id]
    );
    return rows[0] ? JSON.parse(rows[0].payload) as ReceiptEntry : null;
  },

  async generateNextNumero(): Promise<string> {
    return withLog('RegistreRecusService.generateNextNumero', async () => {
      const config = await AssociationConfigService.getOrCreateConfig();
      const year = new Date().getFullYear();
      const counter = (config.nextReceiptNumber ?? 0) + 1;
      await AssociationConfigService.saveConfig({ ...config, nextReceiptNumber: counter });
      return `RECU-${year}-${String(counter).padStart(4, '0')}`;
    });
  },

  async addEntry(entry: Omit<ReceiptEntry, 'id'>): Promise<ReceiptEntry> {
    return withLog('RegistreRecusService.addEntry', async () => {
      const newEntry: ReceiptEntry = { ...entry, id: newEntityId('receipt') };
      await Db.execute('INSERT INTO registre_recus (id, payload) VALUES (?, ?)', [
        newEntry.id,
        JSON.stringify(newEntry),
      ]);
      return newEntry;
    });
  },

  async updatePdfPath(id: string, pdfPath: string): Promise<void> {
    const found = await this.getById(id);
    if (!found) return;
    const updated = { ...found, pdfPath };
    await Db.execute('UPDATE registre_recus SET payload = ? WHERE id = ?', [
      JSON.stringify(updated),
      id,
    ]);
  },

  async annulerRecu(id: string): Promise<void> {
    return withLog('RegistreRecusService.annulerRecu', async () => {
      const found = await this.getById(id);
      if (!found || found.annule) return;
      const updated: ReceiptEntry = {
        ...found,
        annule: true,
        dateAnnulation: new Date().toISOString(),
      };
      await Db.inTransaction('RegistreRecusService.annulerRecu', async () => {
        await Db.execute('UPDATE registre_recus SET payload = ? WHERE id = ?', [
          JSON.stringify(updated),
          id,
        ]);
        await Db.execute(
          'UPDATE donations SET receipt_id = NULL, updated_at = ? WHERE receipt_id = ?',
          [new Date().toISOString(), id]
        );
      });
    });
  },

  async importList(raw: unknown[]): Promise<void> {
    if (!Array.isArray(raw)) return;
    for (const item of raw as ReceiptEntry[]) {
      await Db.execute(
        `INSERT INTO registre_recus (id, payload) VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`,
        [item.id, JSON.stringify(item)]
      );
    }
  },
};
