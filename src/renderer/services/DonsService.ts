import { Don, DonSerialized, DONATEUR_ANONYME_ID } from '../types/Association';
import { FileService } from './FileService';
import { ProfilePaths } from './ProfilePaths';

export class DonsService {
  static async loadDons(): Promise<Don[]> {
    try {
      const content = await FileService.readFile(await ProfilePaths.parametreFile('dons_manuels.json'));
      const parsed: DonSerialized[] = JSON.parse(content);
      return parsed.map((d) => ({
        ...d,
        date: new Date(d.date),
        datePerception: d.datePerception ? new Date(d.datePerception) : undefined,
        createdAt: new Date(d.createdAt),
        updatedAt: new Date(d.updatedAt),
      }));
    } catch {
      return [];
    }
  }

  static async saveDons(dons: Don[]): Promise<void> {
    const serialized: DonSerialized[] = dons.map((d) => ({
      ...d,
      date: d.date instanceof Date ? d.date.toISOString() : d.date,
      datePerception: d.datePerception instanceof Date ? d.datePerception.toISOString() : undefined,
      createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
      updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
    }));
    await FileService.writeFile(await ProfilePaths.parametreFile('dons_manuels.json'), JSON.stringify(serialized, null, 2));
  }

  static async getDonsByDonateur(donateurId: string): Promise<Don[]> {
    const dons = await this.loadDons();
    return dons.filter((d) => d.donateurId === donateurId);
  }

  static async getDonsAnonymes(): Promise<Don[]> {
    const dons = await this.loadDons();
    return dons.filter((d) => d.donateurId === DONATEUR_ANONYME_ID);
  }

  static async upsertDon(don: Don): Promise<void> {
    const dons = await this.loadDons();
    const idx = dons.findIndex((d) => d.id === don.id);
    const now = new Date();
    const normalized: Don = { ...don, updatedAt: now };
    if (idx >= 0) {
      dons[idx] = normalized;
    } else {
      dons.unshift(normalized);
    }
    await this.saveDons(dons);
  }

  static async deleteDon(donId: string): Promise<void> {
    const dons = await this.loadDons();
    await this.saveDons(dons.filter((d) => d.id !== donId));
  }

  static async deleteDonsByDonateur(donateurId: string): Promise<void> {
    const dons = await this.loadDons();
    await this.saveDons(dons.filter((d) => d.donateurId !== donateurId));
  }

  static generateId(): string {
    return `don-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /** Calcule le total des dons manuels pour un donateur sur une période */
  static async getTotalByDonateur(
    donateurId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    const dons = await this.getDonsByDonateur(donateurId);
    return dons
      .filter((d) => {
        if (!startDate && !endDate) return true;
        const dt = d.date instanceof Date ? d.date : new Date(d.date);
        if (startDate && dt < startDate) return false;
        if (endDate && dt > endDate) return false;
        return true;
      })
      .reduce((s, d) => s + d.montant, 0);
  }
}
