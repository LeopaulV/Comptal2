import {
  Devis,
  DevisSerialized,
  Facture,
  FactureSerialized,
  PosteFacture,
  PosteMateriel,
  PosteTravail,
} from '../types/Invoice';
import { FileService } from './FileService';
import { EmetteurService } from './EmetteurService';

const DEVIS_PATH = 'parametre/devis.json';
const FACTURES_PATH = 'parametre/factures.json';

export class InvoiceService {
  private static devisCache: Devis[] | null = null;
  private static facturesCache: Facture[] | null = null;

  static async loadDevis(): Promise<Devis[]> {
    if (this.devisCache) {
      return this.devisCache;
    }
    try {
      const content = await FileService.readFile(DEVIS_PATH);
      const parsed: DevisSerialized[] = JSON.parse(content);
      const devis = parsed.map((item) => this.deserializeDevis(item));
      this.devisCache = devis;
      return devis;
    } catch (error: any) {
      this.devisCache = [];
      return [];
    }
  }

  static async saveDevis(devisList: Devis[]): Promise<void> {
    const serialized = devisList.map((item) => this.serializeDevis(item));
    const content = JSON.stringify(serialized, null, 2);
    await FileService.writeFile(DEVIS_PATH, content);
    this.devisCache = devisList;
  }

  static async loadFactures(): Promise<Facture[]> {
    if (this.facturesCache) {
      return this.facturesCache;
    }
    try {
      const content = await FileService.readFile(FACTURES_PATH);
      const parsed: FactureSerialized[] = JSON.parse(content);
      const factures = parsed.map((item) => this.deserializeFacture(item));
      this.facturesCache = factures;
      return factures;
    } catch (error: any) {
      this.facturesCache = [];
      return [];
    }
  }

  static async softDeleteDevis(devisId: string): Promise<void> {
    const devisList = await this.loadDevis();
    const index = devisList.findIndex((d) => d.id === devisId);
    if (index === -1) return;
    devisList[index] = { ...devisList[index], supprime: true, updatedAt: new Date() };
    await this.saveDevis(devisList);
  }

  static async softDeleteFacture(factureId: string): Promise<void> {
    const factures = await this.loadFactures();
    const index = factures.findIndex((f) => f.id === factureId);
    if (index === -1) return;
    factures[index] = { ...factures[index], supprime: true, updatedAt: new Date() };
    await this.saveFactures(factures);
  }

  static async saveFactures(factures: Facture[]): Promise<void> {
    const serialized = factures.map((item) => this.serializeFacture(item));
    const content = JSON.stringify(serialized, null, 2);
    await FileService.writeFile(FACTURES_PATH, content);
    this.facturesCache = factures;
  }

  static async generateNumero(
    type: 'devis' | 'facture',
    options: { codeClient?: string; clientId?: string; devisNumero?: string } = {},
  ): Promise<string> {
    const settings = await EmetteurService.loadInvoiceSettings();
    const year = new Date().getFullYear();

    if (type === 'devis') {
      const prefix = options.codeClient || settings.prefixeDevis || 'DEVIS';
      const seq = settings.prochainNumeroDevis;
      const formatted = this.formatNumero(settings.formatNumero, prefix, year, seq);
      settings.prochainNumeroDevis += 1;
      await EmetteurService.saveInvoiceSettings(settings);
      return formatted;
    }

    if (!options.devisNumero) {
      throw new Error('Numero de devis manquant');
    }
    const factures = await this.loadFactures();
    const devisPart = options.devisNumero.replace(/^DEVIS-/, '');
    const prefix = `FAC-DEVIS-${devisPart}-`;
    const maxSuffix = factures.reduce((acc, facture) => {
      if (!facture.numero.startsWith(prefix)) {
        return acc;
      }
      const rest = facture.numero.slice(prefix.length);
      const match = rest.match(/^(\d+)/);
      if (!match) return acc;
      const parsed = Number(match[1]);
      return Number.isNaN(parsed) ? acc : Math.max(acc, parsed);
    }, 0);
    const formatted = `${prefix}${String(maxSuffix + 1).padStart(2, '0')}`;
    settings.prochainNumeroFacture += 1;
    await EmetteurService.saveInvoiceSettings(settings);
    return formatted;
  }

  static calculateTotals(postes: PosteFacture[]): { totalHT: number; totalTVA: Record<number, number>; totalTTC: number } {
    const totals = {
      totalHT: 0,
      totalTVA: {} as Record<number, number>,
      totalTTC: 0,
    };

    postes.forEach((poste) => {
      const lineHT = this.calculateLineHT(poste);
      const tvaRate = poste.tauxTVA || 0;
      const lineTVA = (lineHT * tvaRate) / 100;
      totals.totalHT += lineHT;
      totals.totalTVA[tvaRate] = (totals.totalTVA[tvaRate] || 0) + lineTVA;
      totals.totalTTC += lineHT + lineTVA;
    });

    return totals;
  }

  static async convertDevisToFacture(devisId: string): Promise<Facture> {
    const devisList = await this.loadDevis();
    const devis = devisList.find((item) => item.id === devisId);
    if (!devis) {
      throw new Error('Devis introuvable');
    }

    const numero = await this.generateNumero('facture', { devisNumero: devis.numero });
    const facture: Facture = {
      ...devis,
      documentType: 'facture',
      numero,
      devisOrigine: devis.id,
      paiements: [],
      statut: 'envoyee',
    };

    const factures = await this.loadFactures();
    factures.push(facture);
    await this.saveFactures(factures);

    devis.factureGeneree = facture.id;
    devis.updatedAt = new Date();
    await this.saveDevis(devisList);

    return facture;
  }

  static async exportPDF(): Promise<void> {
    throw new Error('Export PDF non implémenté');
  }

  private static calculateLineHT(poste: PosteFacture): number {
    if (poste.type === 'materiel') {
      const p = poste as PosteMateriel;
      let total = p.prixUnitaireHT * p.quantite;
      if (p.remise) {
        total = total * (1 - p.remise / 100);
      }
      if (p.marge) {
        total = total * (1 + p.marge / 100);
      }
      if (p.fraisTransport) {
        total += p.fraisTransport;
      }
      return total;
    }
    const t = poste as PosteTravail;
    let total = t.tauxHoraire * t.heuresEstimees * t.nombreIntervenants;
    if (t.marge) {
      total = total * (1 + t.marge / 100);
    }
    if (t.fraisDeplacement) {
      total += t.fraisDeplacement;
    }
    return total;
  }

  private static serializeDevis(devis: Devis): DevisSerialized {
    return {
      ...devis,
      dateEmission: devis.dateEmission.toISOString(),
      dateEcheance: devis.dateEcheance ? devis.dateEcheance.toISOString() : undefined,
      dateValidite: devis.dateValidite.toISOString(),
      createdAt: devis.createdAt.toISOString(),
      updatedAt: devis.updatedAt.toISOString(),
    };
  }

  private static deserializeDevis(devis: DevisSerialized): Devis {
    return {
      ...devis,
      dateEmission: new Date(devis.dateEmission),
      dateEcheance: devis.dateEcheance ? new Date(devis.dateEcheance) : undefined,
      dateValidite: new Date(devis.dateValidite),
      createdAt: new Date(devis.createdAt),
      updatedAt: new Date(devis.updatedAt),
    };
  }

  private static serializeFacture(facture: Facture): FactureSerialized {
    return {
      ...facture,
      dateEmission: facture.dateEmission.toISOString(),
      dateEcheance: facture.dateEcheance ? facture.dateEcheance.toISOString() : undefined,
      dateLivraison: facture.dateLivraison ? facture.dateLivraison.toISOString() : undefined,
      paiements: facture.paiements.map((p) => ({
        ...p,
        datePaiement: p.datePaiement.toISOString(),
      })),
      createdAt: facture.createdAt.toISOString(),
      updatedAt: facture.updatedAt.toISOString(),
    };
  }

  private static deserializeFacture(facture: FactureSerialized): Facture {
    return {
      ...facture,
      dateEmission: new Date(facture.dateEmission),
      dateEcheance: facture.dateEcheance ? new Date(facture.dateEcheance) : undefined,
      dateLivraison: facture.dateLivraison ? new Date(facture.dateLivraison) : undefined,
      paiements: facture.paiements.map((p) => ({
        ...p,
        datePaiement: new Date(p.datePaiement),
      })),
      createdAt: new Date(facture.createdAt),
      updatedAt: new Date(facture.updatedAt),
    };
  }

  private static formatNumero(format: string, prefix: string, year: number, seq: number): string {
    return format
      .replace('{PREFIX}', prefix)
      .replace('{YEAR}', String(year))
      .replace(/\{SEQ:(\d+)\}/, (_, size) => String(seq).padStart(Number(size), '0'));
  }
}
