import { SecteurActivite } from '../types/invoice';
import { newEntityId } from '../utils/invoiceFormat';
import { Db } from './db';
import { withLog } from './logger';

export const SecteurService = {
  async loadSecteurs(): Promise<SecteurActivite[]> {
    return withLog('SecteurService.loadSecteurs', async () => {
      const rows = await Db.select<{ payload: string }>('SELECT payload FROM secteurs_activite');
      return rows
        .map((r) => JSON.parse(r.payload) as SecteurActivite)
        .sort((a, b) => a.ordre - b.ordre);
    });
  },

  async saveSecteurs(secteurs: SecteurActivite[]): Promise<void> {
    return withLog('SecteurService.saveSecteurs', async () => {
      await Db.execute('DELETE FROM secteurs_activite');
      for (const secteur of secteurs) {
        await Db.execute('INSERT INTO secteurs_activite (id, payload) VALUES (?, ?)', [
          secteur.id,
          JSON.stringify(secteur),
        ]);
      }
    });
  },

  async addSecteur(nom: string): Promise<SecteurActivite> {
    const secteurs = await this.loadSecteurs();
    const secteur: SecteurActivite = {
      id: newEntityId('sec'),
      nom,
      ordre: secteurs.length,
    };
    secteurs.push(secteur);
    await this.saveSecteurs(secteurs);
    return secteur;
  },

  async deleteSecteur(id: string): Promise<void> {
    await this.saveSecteurs((await this.loadSecteurs()).filter((s) => s.id !== id));
  },

  async importList(raw: unknown[]): Promise<void> {
    if (!Array.isArray(raw)) return;
    await this.saveSecteurs(raw as SecteurActivite[]);
  },
};
