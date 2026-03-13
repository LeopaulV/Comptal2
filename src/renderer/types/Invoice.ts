export type TypeEmetteur = 'entreprise' | 'association' | 'auto_entrepreneur' | 'particulier';

export interface Adresse {
  rue: string;
  codePostal: string;
  ville: string;
  pays: string;
}

export interface Emetteur {
  id: string;
  type: TypeEmetteur;
  denominationSociale: string;
  formeJuridique?: string;
  siren?: string;
  siret: string;
  numeroTVA?: string;
  rna?: string;
  codeNAF?: string;
  rcs?: string;
  rm?: string;
  capitalSocial?: number;
  adresse: Adresse;
  telephone?: string;
  email?: string;
  siteWeb?: string;
  logo?: string;
  couleurPrincipale?: string;
  coordonneesBancaires?: {
    titulaire: string;
    iban: string;
    bic: string;
    banque?: string;
  };
  regimeTVA: 'franchise' | 'reel_simplifie' | 'reel_normal' | 'mini_reel';
  regimeFiscal?: 'micro_bic' | 'micro_bnc' | 'reel_simplifie' | 'reel_normal' | 'is';
  mentionFranchiseTVA?: string;
  assurancePro?: {
    compagnie: string;
    numeroPolice: string;
    couvertureGeographique?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceSettings {
  emetteur: Emetteur;
  prefixeDevis: string;
  prefixeFacture: string;
  formatNumero: string;
  prochainNumeroDevis: number;
  prochainNumeroFacture: number;
  tauxTVADefaut: number;
  delaiPaiementDefaut: number;
  conditionsPaiementDefaut: string;
  mentionsPenalitesRetard: string;
  mentionIndemniteRecouvrement: string;
  mentionsParticulieres?: string;
  coordonneesBancairesFacture?: {
    titulaire: string;
    iban: string;
    bic: string;
  };
}

export type TypeClient = 'particulier' | 'entreprise';

export interface Client {
  id: string;
  codeClient?: string;
  type: TypeClient;
  email?: string;
  telephone?: string;
  adresseFacturation: Adresse;
  adresseLivraison?: Adresse;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  civilite?: 'M.' | 'Mme' | 'Mlle';
  nom?: string;
  prenom?: string;
  denominationSociale?: string;
  formeJuridique?: string;
  siren?: string;
  siret?: string;
  numeroTVA?: string;
  codeNAF?: string;
  capitalSocial?: number;
}

export type TypePoste = 'materiel' | 'travail';

export interface PosteMateriel {
  id: string;
  type: 'materiel';
  designation: string;
  reference?: string;
  numeroArticle?: string;
  numeroLot?: string;
  description?: string;
  prixUnitaireHT: number;
  tauxTVA: number;
  quantite: number;
  unite: string;
  remise?: number;
  fraisTransport?: number;
  marge?: number;
  /** ID de l'article de stock de référence (synchro bidirectionnelle des champs communs) */
  articleRefId?: string;
  fournisseur?: string;
  factureRef?: string;
  /** Articles de stock liés à ce poste (consommation par utilisation) */
  articlesLies?: { articleId: string; quantiteParUtilisation: number }[];
}

export interface PosteTravail {
  id: string;
  type: 'travail';
  designation: string;
  description?: string;
  tauxHoraire: number;
  heuresEstimees: number;
  nombreIntervenants: number;
  tauxTVA: number;
  marge?: number;
  fraisDeplacement?: number;
  taches?: string[];
  secteursIds?: string[];
}

export type PosteFacture = PosteMateriel | PosteTravail;

export interface PosteGroupe {
  id: string;
  type: 'groupe';
  nom: string;
  description?: string;
  postes: PosteFacture[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Paiement {
  id: string;
  factureId: string;
  montant: number;
  datePaiement: Date;
  modePaiement: 'virement' | 'cheque' | 'especes' | 'cb' | 'prelevement';
  transactionId?: string;
  reference?: string;
  notes?: string;
}

/** Entrée dans le registre des recettes entreprise (journal persistant) */
export interface RecetteRegistreEntry {
  id: string;
  factureId: string;
  paiementId: string;
  date: string;
  clientName: string;
  factureNumero: string;
  nature: string;
  montantHT: number;
  tva: number;
  montantTTC: number;
  modePaiement: Paiement['modePaiement'];
  reference: string;
  transactionId?: string;
}

export interface DocumentBase {
  id: string;
  numero: string;
  intituleSecondaire?: string;
  clientId: string;
  dateEmission: Date;
  dateEcheance?: Date;
  postes: PosteFacture[];
  vendeur: {
    denominationSociale: string;
    formeJuridique: string;
    adresse: Adresse;
    siren: string;
    siret: string;
    numeroTVA: string;
    capitalSocial?: number;
    rcs?: string;
  };
  totalHT: number;
  totalTVA: Record<number, number>;
  totalTTC: number;
  conditionsPaiement?: string;
  mentionsLegales?: string;
  notes?: string;
  statut: 'brouillon' | 'envoye' | 'accepte' | 'refuse' | 'expire' | 'envoyee' | 'payee_partiellement' | 'payee' | 'en_retard' | 'annulee';
  createdAt: Date;
  updatedAt: Date;
}

export type DevisAttachmentMode = 'link' | 'copy';

export interface DevisAttachment {
  mode: DevisAttachmentMode;
  path: string;
  name: string;
  mimeType?: string;
}

export interface Devis extends DocumentBase {
  documentType: 'devis';
  dateValidite: Date;
  factureGeneree?: string;
  attachment?: DevisAttachment;
  supprime?: boolean;
}

export interface FactureAttachment {
  mode: 'link' | 'copy';
  path: string;
  name: string;
  mimeType?: string;
}

export interface Facture extends DocumentBase {
  documentType: 'facture';
  devisOrigine?: string;
  dateLivraison?: Date;
  numeroCommande?: string;
  paiements: Paiement[];
  statut: 'brouillon' | 'envoyee' | 'payee_partiellement' | 'payee' | 'en_retard' | 'annulee';
  supprime?: boolean;
  attachment?: FactureAttachment;
}

export interface FactureSerialized extends Omit<Facture, 'dateEmission' | 'dateEcheance' | 'dateLivraison' | 'createdAt' | 'updatedAt' | 'paiements'> {
  dateEmission: string;
  dateEcheance?: string;
  dateLivraison?: string;
  paiements: PaiementSerialized[];
  createdAt: string;
  updatedAt: string;
}

export interface DevisSerialized extends Omit<Devis, 'dateEmission' | 'dateEcheance' | 'dateValidite' | 'createdAt' | 'updatedAt'> {
  dateEmission: string;
  dateEcheance?: string;
  dateValidite: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaiementSerialized extends Omit<Paiement, 'datePaiement'> {
  datePaiement: string;
}

export interface EmetteurSerialized extends Omit<Emetteur, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceSettingsSerialized extends Omit<InvoiceSettings, 'emetteur'> {
  emetteur: EmetteurSerialized;
}

// ============================================
// TYPES POUR TEMPLATES PDF ET MENTIONS LÉGALES
// ============================================

export type PDFFormat = 'A4' | 'Letter';
export type PDFOrientation = 'portrait' | 'landscape';
export type LogoPosition = 'left' | 'right' | 'center';
export type MentionLegaleCategory = 'tva' | 'penalites' | 'assurance' | 'juridique' | 'autre';
export type MentionLegaleType = 'predefined' | 'custom';

export interface PDFTypography {
  headerFont: string;
  bodyFont: string;
  fontSize: {
    title: number;
    header: number;
    body: number;
    footer: number;
  };
}

export interface PDFColors {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  border: string;
}

export interface PDFMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PDFLogoSize {
  width: number;
  height: number;
}

export interface PDFLayout {
  margins: PDFMargins;
  headerHeight: number;
  footerHeight: number;
  logoPosition: LogoPosition;
  logoSize: PDFLogoSize;
}

export interface PDFTemplate {
  id: string;
  name: string;
  description?: string;
  format: PDFFormat;
  orientation: PDFOrientation;
  typography: PDFTypography;
  colors: PDFColors;
  layout: PDFLayout;
  isDefault?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PDFTemplateSerialized extends Omit<PDFTemplate, 'createdAt' | 'updatedAt'> {
  createdAt?: string;
  updatedAt?: string;
}

export interface MentionLegale {
  id: string;
  type: MentionLegaleType;
  label: string;
  content: string;
  category: MentionLegaleCategory;
  required?: boolean;
  enabled?: boolean;
}

export interface EmetteurAccountLink {
  accountCode: string;
  accountName: string;
  isPrimary: boolean;
  color?: string;
}

/** Valeurs de remplacement pour les placeholders [Nom] dans le contenu des mentions légales. mentionId -> { "Nom": "valeur" } */
export type MentionPlaceholderValues = Record<string, Record<string, string>>;

export interface EmetteurExtended extends Emetteur {
  linkedAccounts?: EmetteurAccountLink[];
  pdfTemplateDevis?: string;
  pdfTemplateFacture?: string;
  selectedMentionsLegales?: string[];
  customMentionsLegales?: MentionLegale[];
  /** Valeurs pour les éléments entre crochets dans les mentions (ex: [Compagnie], [Numéro]) */
  mentionPlaceholderValues?: MentionPlaceholderValues;
}

export interface EmetteurExtendedSerialized extends Omit<EmetteurExtended, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceSettingsExtended extends Omit<InvoiceSettings, 'emetteur'> {
  emetteur: EmetteurExtended;
  pdfTemplates?: PDFTemplate[];
  mentionsLegales?: MentionLegale[];
}

export interface InvoiceSettingsExtendedSerialized extends Omit<InvoiceSettingsExtended, 'emetteur' | 'pdfTemplates'> {
  emetteur: EmetteurExtendedSerialized;
  pdfTemplates?: PDFTemplateSerialized[];
}
