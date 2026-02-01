import { 
  Emetteur, 
  EmetteurSerialized, 
  EmetteurExtended, 
  EmetteurExtendedSerialized,
  InvoiceSettings, 
  InvoiceSettingsSerialized 
} from '../types/Invoice';
import { FileService } from './FileService';

const EMETTEUR_PATH = 'parametre/emetteur.json';
const SETTINGS_PATH = 'parametre/invoice_settings.json';

export class EmetteurService {
  private static emetteurCache: Emetteur | null = null;
  private static settingsCache: InvoiceSettings | null = null;

  static async loadEmetteur(): Promise<Emetteur | null> {
    if (this.emetteurCache) {
      return this.emetteurCache;
    }

    try {
      const content = await FileService.readFile(EMETTEUR_PATH);
      const parsed: EmetteurSerialized = JSON.parse(content);
      const emetteur: Emetteur = {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        updatedAt: new Date(parsed.updatedAt),
      };
      this.emetteurCache = emetteur;
      return emetteur;
    } catch (error: any) {
      return null;
    }
  }

  static async saveEmetteur(emetteur: Emetteur): Promise<void> {
    const errors = this.validateEmetteur(emetteur);
    if (errors.length > 0) {
      throw new Error(`Émetteur invalide: ${errors.join(', ')}`);
    }

    const serialized: EmetteurSerialized = {
      ...emetteur,
      createdAt: emetteur.createdAt ? emetteur.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const content = JSON.stringify(serialized, null, 2);
    await FileService.writeFile(EMETTEUR_PATH, content);
    this.emetteurCache = {
      ...emetteur,
      updatedAt: new Date(serialized.updatedAt),
      createdAt: new Date(serialized.createdAt),
    };
  }

  static validateEmetteur(emetteur: Emetteur): string[] {
    const errors: string[] = [];

    if (!emetteur.denominationSociale) {
      errors.push('denominationSociale');
    }
    if (!emetteur.siret || !this.validateSiret(emetteur.siret)) {
      errors.push('siret');
    }
    if (!emetteur.adresse?.rue || !emetteur.adresse?.codePostal || !emetteur.adresse?.ville || !emetteur.adresse?.pays) {
      errors.push('adresse');
    }
    if (!emetteur.type) {
      errors.push('type');
    }

    if (emetteur.type === 'entreprise') {
      if (!emetteur.siren || emetteur.siren.length !== 9) {
        errors.push('siren');
      }
      if (!emetteur.formeJuridique) {
        errors.push('formeJuridique');
      }
      // RCS optionnel : souvent omis pour les petites structures ou auto-entrepreneurs
    }

    if (emetteur.type === 'association') {
      if (!emetteur.rna) {
        errors.push('rna');
      }
    }

    if (emetteur.type === 'auto_entrepreneur') {
      if (!emetteur.siren || emetteur.siren.length !== 9) {
        errors.push('siren');
      }
    }

    if (emetteur.numeroTVA && !this.validateNumeroTVA(emetteur.numeroTVA)) {
      errors.push('numeroTVA');
    }

    if (emetteur.coordonneesBancaires?.iban && !this.validateIban(emetteur.coordonneesBancaires.iban)) {
      errors.push('iban');
    }

    return errors;
  }

  static validateSiret(siret: string): boolean {
    const cleaned = siret.replace(/\s+/g, '');
    if (!/^\d{14}$/.test(cleaned)) {
      return false;
    }
    return this.isLuhnValid(cleaned);
  }

  static validateIban(iban: string): boolean {
    const cleaned = iban.replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(cleaned)) {
      return false;
    }
    const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
    const expanded = rearranged.replace(/[A-Z]/g, (char) => (char.charCodeAt(0) - 55).toString());
    return this.mod97(expanded) === 1;
  }

  static validateNumeroTVA(numeroTVA: string): boolean {
    const cleaned = numeroTVA.replace(/\s+/g, '').toUpperCase();
    return /^FR\d{2}\d{9}$/.test(cleaned);
  }

  static calculateNumeroTVA(siren: string): string {
    const cleaned = siren.replace(/\s+/g, '');
    if (!/^\d{9}$/.test(cleaned)) {
      throw new Error('SIREN invalide');
    }
    const sirenNum = Number(cleaned);
    const key = (12 + 3 * (sirenNum % 97)) % 97;
    const keyStr = key.toString().padStart(2, '0');
    return `FR${keyStr}${cleaned}`;
  }

  static async loadInvoiceSettings(): Promise<InvoiceSettings> {
    if (this.settingsCache) {
      return this.settingsCache;
    }
    try {
      const content = await FileService.readFile(SETTINGS_PATH);
      const parsed: InvoiceSettingsSerialized = JSON.parse(content);
      const settings: InvoiceSettings = {
        ...parsed,
        emetteur: {
          ...parsed.emetteur,
          createdAt: new Date(parsed.emetteur.createdAt),
          updatedAt: new Date(parsed.emetteur.updatedAt),
        },
      };
      this.settingsCache = settings;
      return settings;
    } catch (error: any) {
      const emetteur = await this.loadEmetteur();
      if (!emetteur) {
        throw new Error('Émetteur non configuré');
      }
      const defaults = this.createDefaultSettings(emetteur);
      this.settingsCache = defaults;
      return defaults;
    }
  }

  static async saveInvoiceSettings(settings: InvoiceSettings): Promise<void> {
    const serialized: InvoiceSettingsSerialized = {
      ...settings,
      emetteur: {
        ...settings.emetteur,
        createdAt: settings.emetteur.createdAt.toISOString(),
        updatedAt: settings.emetteur.updatedAt.toISOString(),
      },
    };
    const content = JSON.stringify(serialized, null, 2);
    await FileService.writeFile(SETTINGS_PATH, content);
    this.settingsCache = settings;
  }

  static async isEmetteurConfigured(): Promise<boolean> {
    const emetteur = await this.loadEmetteur();
    if (!emetteur) {
      return false;
    }
    return this.validateEmetteur(emetteur).length === 0;
  }

  private static createDefaultSettings(emetteur: Emetteur): InvoiceSettings {
    return {
      emetteur,
      prefixeDevis: 'DEVIS',
      prefixeFacture: 'FAC',
      formatNumero: '{PREFIX}-{YEAR}-{SEQ:4}',
      prochainNumeroDevis: 1,
      prochainNumeroFacture: 1,
      tauxTVADefaut: 20,
      delaiPaiementDefaut: 30,
      conditionsPaiementDefaut: 'Paiement à 30 jours',
      mentionsPenalitesRetard: 'Pénalités de retard exigibles en cas de non-paiement',
      mentionIndemniteRecouvrement: 'Indemnité forfaitaire de recouvrement: 40€ (B2B)',
    };
  }

  // ============================================
  // MÉTHODES POUR ÉMETTEUR ÉTENDU
  // ============================================

  private static extendedEmetteurCache: EmetteurExtended | null = null;
  private static readonly EXTENDED_EMETTEUR_PATH = 'parametre/emetteur_extended.json';

  /**
   * Charge l'émetteur étendu avec les comptes liés et configurations PDF
   */
  static async loadEmetteurExtended(): Promise<EmetteurExtended | null> {
    if (this.extendedEmetteurCache) {
      return this.extendedEmetteurCache;
    }

    try {
      const content = await FileService.readFile(this.EXTENDED_EMETTEUR_PATH);
      const parsed: EmetteurExtendedSerialized = JSON.parse(content);
      const emetteur: EmetteurExtended = {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        updatedAt: new Date(parsed.updatedAt),
      };
      this.extendedEmetteurCache = emetteur;
      return emetteur;
    } catch (error: any) {
      // Si pas d'émetteur étendu, essayer de charger l'émetteur de base
      const baseEmetteur = await this.loadEmetteur();
      if (baseEmetteur) {
        const extended: EmetteurExtended = {
          ...baseEmetteur,
          linkedAccounts: [],
          selectedMentionsLegales: [],
          customMentionsLegales: [],
          mentionPlaceholderValues: {},
        };
        return extended;
      }
      return null;
    }
  }

  /**
   * Sauvegarde l'émetteur étendu
   */
  static async saveEmetteurExtended(emetteur: EmetteurExtended): Promise<void> {
    // Valider l'émetteur de base
    const errors = this.validateEmetteur(emetteur);
    if (errors.length > 0) {
      throw new Error(`Émetteur invalide: ${errors.join(', ')}`);
    }

    const serialized: EmetteurExtendedSerialized = {
      ...emetteur,
      createdAt: emetteur.createdAt ? emetteur.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const content = JSON.stringify(serialized, null, 2);
    await FileService.writeFile(this.EXTENDED_EMETTEUR_PATH, content);

    // Mettre à jour le cache
    this.extendedEmetteurCache = {
      ...emetteur,
      updatedAt: new Date(serialized.updatedAt),
      createdAt: new Date(serialized.createdAt),
    };

    // Sauvegarder aussi l'émetteur de base pour compatibilité
    await this.saveEmetteur(emetteur);
  }

  /**
   * Vérifie si l'émetteur étendu est configuré
   */
  static async isEmetteurExtendedConfigured(): Promise<boolean> {
    const emetteur = await this.loadEmetteurExtended();
    if (!emetteur) {
      return false;
    }
    return this.validateEmetteur(emetteur).length === 0;
  }

  /**
   * Invalide le cache de l'émetteur étendu
   */
  static clearExtendedCache(): void {
    this.extendedEmetteurCache = null;
  }

  private static isLuhnValid(value: string): boolean {
    let sum = 0;
    let shouldDouble = false;
    for (let i = value.length - 1; i >= 0; i--) {
      let digit = parseInt(value.charAt(i), 10);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  }

  private static mod97(value: string): number {
    let checksum = 0;
    for (let i = 0; i < value.length; i++) {
      const charCode = value.charCodeAt(i) - 48;
      if (charCode < 0 || charCode > 9) {
        return -1;
      }
      checksum = (checksum * 10 + charCode) % 97;
    }
    return checksum;
  }
}
