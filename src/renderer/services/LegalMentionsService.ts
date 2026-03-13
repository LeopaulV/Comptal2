import { MentionLegale, MentionLegaleCategory, MentionPlaceholderValues } from '../types/Invoice';
import { FileService } from './FileService';

const MENTIONS_PATH = 'parametre/mentions_legales.json';

// Mentions légales françaises prédéfinies
const PREDEFINED_MENTIONS: MentionLegale[] = [
  // TVA
  {
    id: 'mention-franchise-tva',
    type: 'predefined',
    label: 'Franchise en base de TVA',
    content: 'TVA non applicable, art. 293 B du CGI',
    category: 'tva',
    required: false,
    enabled: true,
  },
  {
    id: 'mention-tva-non-applicable',
    type: 'predefined',
    label: 'TVA non applicable (exonération)',
    content: 'Exonération de TVA en application de l\'article 261 du CGI',
    category: 'tva',
    required: false,
    enabled: false,
  },
  {
    id: 'mention-autoliquidation-tva',
    type: 'predefined',
    label: 'Autoliquidation de la TVA',
    content: 'Autoliquidation de la TVA par le preneur en application de l\'article 283-2 nonies du CGI',
    category: 'tva',
    required: false,
    enabled: false,
  },
  {
    id: 'mention-tva-marge',
    type: 'predefined',
    label: 'TVA sur la marge',
    content: 'TVA calculée sur la marge conformément aux articles 297 A et suivants du CGI',
    category: 'tva',
    required: false,
    enabled: false,
  },

  // Pénalités
  {
    id: 'mention-penalites-retard',
    type: 'predefined',
    label: 'Pénalités de retard',
    content: 'En cas de retard de paiement, une pénalité égale à 3 fois le taux d\'intérêt légal sera exigible (loi n°2008-776 du 4 août 2008)',
    category: 'penalites',
    required: true,
    enabled: true,
  },
  {
    id: 'mention-indemnite-recouvrement',
    type: 'predefined',
    label: 'Indemnité forfaitaire de recouvrement',
    content: 'Pour tout retard de paiement, une indemnité forfaitaire de 40€ pour frais de recouvrement sera due (Art. D. 441-5 du Code de commerce)',
    category: 'penalites',
    required: true,
    enabled: true,
  },
  {
    id: 'mention-escompte',
    type: 'predefined',
    label: 'Escompte pour paiement anticipé',
    content: 'Aucun escompte ne sera pratiqué pour paiement anticipé',
    category: 'penalites',
    required: false,
    enabled: true,
  },
  {
    id: 'mention-escompte-accordé',
    type: 'predefined',
    label: 'Escompte accordé',
    content: 'Un escompte de 2% sera accordé en cas de paiement comptant',
    category: 'penalites',
    required: false,
    enabled: false,
  },

  // Assurance
  {
    id: 'mention-assurance-pro',
    type: 'predefined',
    label: 'Assurance professionnelle',
    content: 'Assurance responsabilité civile professionnelle souscrite auprès de [Compagnie], police n°[Numéro]',
    category: 'assurance',
    required: false,
    enabled: false,
  },
  {
    id: 'mention-garantie-decennale',
    type: 'predefined',
    label: 'Garantie décennale (BTP)',
    content: 'Garantie décennale souscrite auprès de [Compagnie], police n°[Numéro], couvrant le territoire français',
    category: 'assurance',
    required: false,
    enabled: false,
  },

  // Juridique
  {
    id: 'mention-rcs',
    type: 'predefined',
    label: 'Mention RCS',
    content: 'RCS [Ville] [Numéro]',
    category: 'juridique',
    required: false,
    enabled: false,
  },
  {
    id: 'mention-capital',
    type: 'predefined',
    label: 'Capital social',
    content: 'Capital social : [Montant] €',
    category: 'juridique',
    required: false,
    enabled: false,
  },
  {
    id: 'mention-mediateur',
    type: 'predefined',
    label: 'Médiation de la consommation',
    content: 'En cas de litige, le consommateur peut recourir gratuitement au service de médiation de la consommation accessible via [URL du médiateur]',
    category: 'juridique',
    required: false,
    enabled: false,
  },
  {
    id: 'mention-tribunal-competent',
    type: 'predefined',
    label: 'Tribunal compétent',
    content: 'En cas de litige, le tribunal de commerce de [Ville] sera seul compétent',
    category: 'juridique',
    required: false,
    enabled: false,
  },

  // Autres
  {
    id: 'mention-cgv',
    type: 'predefined',
    label: 'Conditions générales de vente',
    content: 'Conditions générales de vente disponibles sur demande ou sur notre site internet',
    category: 'autre',
    required: false,
    enabled: false,
  },
  {
    id: 'mention-retractation',
    type: 'predefined',
    label: 'Droit de rétractation (B2C)',
    content: 'Le consommateur dispose d\'un délai de 14 jours à compter de la réception du bien pour exercer son droit de rétractation (Art. L221-18 du Code de la consommation)',
    category: 'autre',
    required: false,
    enabled: false,
  },
  {
    id: 'mention-propriete-intellectuelle',
    type: 'predefined',
    label: 'Propriété intellectuelle',
    content: 'Les créations réalisées restent la propriété intellectuelle du prestataire jusqu\'au paiement intégral de la facture',
    category: 'autre',
    required: false,
    enabled: false,
  },
  {
    id: 'mention-reserve-propriete',
    type: 'predefined',
    label: 'Clause de réserve de propriété',
    content: 'Les marchandises restent la propriété du vendeur jusqu\'au paiement intégral du prix (Art. 2367 du Code civil)',
    category: 'autre',
    required: false,
    enabled: false,
  },
];

export class LegalMentionsService {
  private static mentionsCache: MentionLegale[] | null = null;

  /**
   * Retourne les mentions légales prédéfinies
   */
  static getPredefinedMentions(): MentionLegale[] {
    return [...PREDEFINED_MENTIONS];
  }

  /**
   * Charge toutes les mentions (prédéfinies + personnalisées)
   */
  static async loadMentions(): Promise<MentionLegale[]> {
    if (this.mentionsCache) {
      return this.mentionsCache;
    }

    try {
      const content = await FileService.readFile(MENTIONS_PATH);
      const parsed = JSON.parse(content);
      // Sécurité : si le JSON n'est pas un tableau (ex: '{}' sur profil neuf), utiliser les mentions prédéfinies
      if (!Array.isArray(parsed)) {
        console.warn('[LegalMentionsService] Contenu invalide (non-tableau), utilisation des mentions prédéfinies');
        this.mentionsCache = this.getPredefinedMentions();
        return this.mentionsCache;
      }
      this.mentionsCache = parsed as MentionLegale[];
      return this.mentionsCache;
    } catch (error) {
      // Si le fichier n'existe pas, retourner les mentions prédéfinies
      console.log('[LegalMentionsService] Fichier non trouvé, utilisation des mentions prédéfinies');
      this.mentionsCache = this.getPredefinedMentions();
      return this.mentionsCache;
    }
  }

  /**
   * Sauvegarde toutes les mentions
   */
  static async saveMentions(mentions: MentionLegale[]): Promise<void> {
    const content = JSON.stringify(mentions, null, 2);
    await FileService.writeFile(MENTIONS_PATH, content);
    this.mentionsCache = mentions;
  }

  /**
   * Récupère une mention par son ID
   */
  static async getMentionById(id: string): Promise<MentionLegale | null> {
    const mentions = await this.loadMentions();
    return mentions.find((m) => m.id === id) || null;
  }

  /**
   * Récupère les mentions par catégorie
   */
  static async getMentionsByCategory(category: MentionLegaleCategory): Promise<MentionLegale[]> {
    const mentions = await this.loadMentions();
    return mentions.filter((m) => m.category === category);
  }

  /**
   * Récupère les mentions activées
   */
  static async getEnabledMentions(): Promise<MentionLegale[]> {
    const mentions = await this.loadMentions();
    return mentions.filter((m) => m.enabled);
  }

  /**
   * Ajoute ou met à jour une mention personnalisée
   */
  static async saveCustomMention(mention: MentionLegale): Promise<void> {
    const mentions = await this.loadMentions();
    const index = mentions.findIndex((m) => m.id === mention.id);

    const updatedMention: MentionLegale = {
      ...mention,
      type: mention.type || 'custom',
    };

    if (index >= 0) {
      mentions[index] = updatedMention;
    } else {
      mentions.push(updatedMention);
    }

    await this.saveMentions(mentions);
  }

  /**
   * Active ou désactive une mention
   */
  static async toggleMention(id: string, enabled: boolean): Promise<void> {
    const mentions = await this.loadMentions();
    const index = mentions.findIndex((m) => m.id === id);

    if (index >= 0) {
      mentions[index] = { ...mentions[index], enabled };
      await this.saveMentions(mentions);
    }
  }

  /**
   * Supprime une mention personnalisée (les mentions prédéfinies ne peuvent pas être supprimées)
   */
  static async deleteMention(id: string): Promise<boolean> {
    const predefinedIds = PREDEFINED_MENTIONS.map((m) => m.id);
    if (predefinedIds.includes(id)) {
      console.warn('[LegalMentionsService] Impossible de supprimer une mention prédéfinie');
      return false;
    }

    const mentions = await this.loadMentions();
    const filtered = mentions.filter((m) => m.id !== id);

    if (filtered.length === mentions.length) {
      return false;
    }

    await this.saveMentions(filtered);
    return true;
  }

  /**
   * Réinitialise les mentions aux valeurs par défaut
   */
  static async resetToDefaults(): Promise<void> {
    const defaults = this.getPredefinedMentions();
    await this.saveMentions(defaults);
  }

  /**
   * Extrait les noms de placeholders (entre crochets) d'un contenu, ex: "[Compagnie]" -> "Compagnie"
   */
  static extractPlaceholders(content: string): string[] {
    const matches = content.match(/\[([^\]]+)\]/g);
    if (!matches) return [];
    const unique = new Set<string>();
    matches.forEach((m) => unique.add(m.replace(/^\[|\]$/g, '').trim()));
    return Array.from(unique);
  }

  /**
   * Remplace les placeholders [Nom] dans le contenu par les valeurs fournies
   */
  static replacePlaceholders(
    content: string,
    values?: Record<string, string>
  ): string {
    if (!values) return content;
    let result = content;
    Object.entries(values).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\[${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'g'), value || '');
    });
    // Remplacer les [X] restants par chaîne vide pour ne pas laisser [X] sur le PDF
    result = result.replace(/\[[^\]]+\]/g, '');
    return result;
  }

  /**
   * Génère le texte complet des mentions légales pour un document
   * @param mentionIds IDs des mentions sélectionnées
   * @param customMentions Mentions personnalisées de l'émetteur (affichées sur le PDF si sélectionnées)
   * @param placeholderValues Valeurs pour les [Placeholder] dans le contenu
   */
  static async generateMentionsText(
    mentionIds: string[],
    customMentions: MentionLegale[] = [],
    placeholderValues: MentionPlaceholderValues = {}
  ): Promise<string> {
    if (!mentionIds || mentionIds.length === 0) return '';
    const fromFile = await this.loadMentions();
    const allMentions = [
      ...fromFile,
      ...customMentions.filter((cm) => !fromFile.some((m) => m.id === cm.id)),
    ];
    const selectedMentions = allMentions.filter((m) => mentionIds.includes(m.id));
    const lines = selectedMentions.map((m) => {
      const values = placeholderValues[m.id];
      return this.replacePlaceholders(m.content, values);
    });
    return lines.join('\n');
  }

  /**
   * Récupère les catégories disponibles avec leurs labels
   */
  static getCategories(): Array<{ value: MentionLegaleCategory; label: string }> {
    return [
      { value: 'tva', label: 'TVA' },
      { value: 'penalites', label: 'Pénalités et paiement' },
      { value: 'assurance', label: 'Assurance' },
      { value: 'juridique', label: 'Juridique' },
      { value: 'autre', label: 'Autres' },
    ];
  }

  /**
   * Invalide le cache
   */
  static clearCache(): void {
    this.mentionsCache = null;
  }
}
