import { MentionLegale, MentionLegaleCategory, MentionPlaceholderValues } from '../types/invoice';
import { newEntityId } from '../utils/invoiceFormat';
import { Db } from './db';
import { withLog } from './logger';

export const PREDEFINED_MENTIONS: MentionLegale[] = [
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
    content: "Exonération de TVA en application de l'article 261 du CGI",
    category: 'tva',
    required: false,
    enabled: false,
  },
  {
    id: 'mention-autoliquidation-tva',
    type: 'predefined',
    label: 'Autoliquidation de la TVA',
    content:
      "Autoliquidation de la TVA par le preneur en application de l'article 283-2 nonies du CGI",
    category: 'tva',
    required: false,
    enabled: false,
  },
  {
    id: 'mention-penalites-retard',
    type: 'predefined',
    label: 'Pénalités de retard',
    content:
      "En cas de retard de paiement, une pénalité égale à 3 fois le taux d'intérêt légal sera exigible (loi n°2008-776 du 4 août 2008)",
    category: 'penalites',
    required: true,
    enabled: true,
  },
  {
    id: 'mention-indemnite-recouvrement',
    type: 'predefined',
    label: 'Indemnité forfaitaire de recouvrement',
    content:
      'Pour tout retard de paiement, une indemnité forfaitaire de 40€ pour frais de recouvrement sera due (Art. D. 441-5 du Code de commerce)',
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
    id: 'mention-assurance-pro',
    type: 'predefined',
    label: 'Assurance professionnelle',
    content:
      'Assurance responsabilité civile professionnelle souscrite auprès de [Compagnie], police n°[Numéro]',
    category: 'assurance',
    required: false,
    enabled: false,
  },
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
    id: 'mention-reserve-propriete',
    type: 'predefined',
    label: 'Clause de réserve de propriété',
    content:
      'Les marchandises restent la propriété du vendeur jusqu’au paiement intégral du prix (Art. 2367 du Code civil)',
    category: 'autre',
    required: false,
    enabled: false,
  },
];

export const LegalMentionsService = {
  getPredefinedMentions(): MentionLegale[] {
    return PREDEFINED_MENTIONS.map((m) => ({ ...m }));
  },

  getCategories(): Array<{ value: MentionLegaleCategory; label: string }> {
    return [
      { value: 'tva', label: 'TVA' },
      { value: 'penalites', label: 'Pénalités et paiement' },
      { value: 'assurance', label: 'Assurance' },
      { value: 'juridique', label: 'Juridique' },
      { value: 'autre', label: 'Autres' },
    ];
  },

  async loadMentions(): Promise<MentionLegale[]> {
    return withLog('LegalMentionsService.loadMentions', async () => {
      const rows = await Db.select<{ payload: string }>('SELECT payload FROM legal_mentions');
      if (rows.length === 0) {
        await this.saveMentions(this.getPredefinedMentions());
        return this.getPredefinedMentions();
      }
      return rows.map((r) => JSON.parse(r.payload) as MentionLegale);
    });
  },

  async saveMentions(mentions: MentionLegale[]): Promise<void> {
    return withLog('LegalMentionsService.saveMentions', async () => {
      await Db.execute('DELETE FROM legal_mentions');
      for (const m of mentions) {
        await Db.execute('INSERT INTO legal_mentions (id, payload) VALUES (?, ?)', [
          m.id,
          JSON.stringify(m),
        ]);
      }
    });
  },

  async saveCustomMention(mention: MentionLegale): Promise<MentionLegale> {
    const mentions = await this.loadMentions();
    const updated: MentionLegale = {
      ...mention,
      id: mention.id || newEntityId('mention'),
      type: mention.type || 'custom',
    };
    const index = mentions.findIndex((m) => m.id === updated.id);
    if (index >= 0) mentions[index] = updated;
    else mentions.push(updated);
    await this.saveMentions(mentions);
    return updated;
  },

  async toggleMention(id: string, enabled: boolean): Promise<void> {
    const mentions = await this.loadMentions();
    const index = mentions.findIndex((m) => m.id === id);
    if (index >= 0) {
      mentions[index] = { ...mentions[index], enabled };
      await this.saveMentions(mentions);
    }
  },

  async deleteMention(id: string): Promise<boolean> {
    if (PREDEFINED_MENTIONS.some((m) => m.id === id)) return false;
    await this.saveMentions((await this.loadMentions()).filter((m) => m.id !== id));
    return true;
  },

  extractPlaceholders(content: string): string[] {
    const matches = content.match(/\[([^\]]+)\]/g);
    if (!matches) return [];
    return Array.from(new Set(matches.map((m) => m.replace(/^\[|\]$/g, '').trim())));
  },

  replacePlaceholders(
    content: string,
    values?: Record<string, string>,
    keepUnfilled = false
  ): string {
    if (!values) return keepUnfilled ? content : content.replace(/\[[^\]]+\]/g, '');
    let result = content;
    Object.entries(values).forEach(([key, value]) => {
      if (!value && keepUnfilled) return;
      result = result.replace(
        new RegExp(`\\[${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'g'),
        value || ''
      );
    });
    return keepUnfilled ? result : result.replace(/\[[^\]]+\]/g, '');
  },

  async generateMentionsText(
    mentionIds: string[],
    customMentions: MentionLegale[] = [],
    placeholderValues: MentionPlaceholderValues = {},
    keepUnfilled = false
  ): Promise<string> {
    if (!mentionIds.length) return '';
    const fromFile = await this.loadMentions();
    const allMentions = [
      ...fromFile,
      ...customMentions.filter((cm) => !fromFile.some((m) => m.id === cm.id)),
    ];
    const byId = new Map(allMentions.map((mention) => [mention.id, mention]));
    return mentionIds
      .map((id) => byId.get(id))
      .filter((mention): mention is MentionLegale => Boolean(mention))
      .map((mention) =>
        this.replacePlaceholders(mention.content, placeholderValues[mention.id], keepUnfilled)
      )
      .filter((line) => line.trim().length > 0)
      .join('\n');
  },

  async importList(raw: unknown[]): Promise<void> {
    if (!Array.isArray(raw) || raw.length === 0) return;
    await this.saveMentions(raw as MentionLegale[]);
  },
};
