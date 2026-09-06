import { Adresse } from './invoice';

export type TypeDonateur = 'particulier' | 'entreprise';

export interface Donateur {
  id: string;
  type: TypeDonateur;
  civilite?: 'M.' | 'Mme' | 'Mlle';
  nom?: string;
  prenom?: string;
  denominationSociale?: string;
  formeJuridique?: string;
  siren?: string;
  siret?: string;
  adresse: Adresse;
  email?: string;
  telephone?: string;
  categoryCode?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NatureDon = 'numeraire' | 'nature' | 'mecenat_competences';
export type ModeVersement = 'virement' | 'cheque' | 'especes' | 'cb' | 'prelevement' | 'autre';

export interface Don {
  id: string;
  donateurId: string;
  donorLabel?: string;
  montant: number;
  date: Date;
  datePerception?: Date;
  modeVersement?: ModeVersement;
  natureDon: NatureDon;
  description?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const DONATEUR_ANONYME_ID = 'ANONYME';

export interface AssociationConfig {
  denominationSociale: string;
  objetSocial: string;
  rna?: string;
  siren?: string;
  siret?: string;
  adresse: Adresse;
  telephone?: string;
  email?: string;
  siteWeb?: string;
  logo?: string;
  statutOIG?: boolean;
  datePublicationJO?: string;
  referencesCGI?: string;
  pdfTemplateRecuFiscal?: string;
  signataireNom?: string;
  signataireQualite?: string;
  /** Image PNG (data URL) de la signature électronique du représentant légal. */
  signataireSignature?: string;
  formeJuridique?: string;
  prefectureDeclaration?: string;
  dateCreation?: string;
  numeroRecepisse?: string;
  nextReceiptNumber?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReceiptEntry {
  id: string;
  numero: string;
  donationId?: string;
  donationIds?: string[];
  donateurId: string;
  donateurLabel: string;
  montant: number;
  date: string;
  dateEmission: string;
  natureDon?: NatureDon;
  modeVersement?: ModeVersement;
  annule?: boolean;
  dateAnnulation?: string;
  pdfPath?: string;
}

export interface DonateurTransactionMapping {
  [transactionId: string]: string;
}

export type DonationSource = 'manuel' | 'transaction';

export interface Donation {
  id: string;
  contactId: string | null;
  anonymous: boolean;
  donorLabel?: string;
  source: DonationSource;
  transactionId?: string;
  natureDon: NatureDon;
  modeVersement?: ModeVersement;
  /** Montant versé ou valorisation communiquée par le donateur pour un don en nature. */
  montant: number;
  date: string;
  datePerception?: string;
  description?: string;
  valuationMethod?: string;
  valuationProvidedByDonor?: boolean;
  notes?: string;
  receiptEligible: boolean;
  receiptId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DonationRule {
  id: string;
  contactId: string;
  labelContains: string;
  categoryCode?: string;
  modeVersement: ModeVersement;
  active: boolean;
  createdAt: string;
}

export interface ReceiptSignature {
  imageDataUrl: string;
  signedAt: string;
}
