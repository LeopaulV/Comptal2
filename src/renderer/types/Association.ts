// Types pour la gestion des associations (CERFA)

import { Adresse } from './Invoice';

export type TypeDonateur = 'particulier' | 'entreprise';

export interface Donateur {
  id: string;
  type: TypeDonateur;
  /** Pour particulier */
  civilite?: 'M.' | 'Mme' | 'Mlle';
  nom?: string;
  prenom?: string;
  /** Pour entreprise */
  denominationSociale?: string;
  formeJuridique?: string;
  siren?: string;
  siret?: string;
  adresse: Adresse;
  email?: string;
  telephone?: string;
  /** Code catégorie lié (référence categories.json) */
  categoryCode?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NatureDon = 'numeraire' | 'nature' | 'mecenat_competences';
export type ModeVersement = 'virement' | 'cheque' | 'especes' | 'cb' | 'prelevement' | 'autre';

export interface Don {
  id: string;
  /** ID du donateur, ou 'ANONYME' pour un don non identifié */
  donateurId: string;
  /** Libellé libre pour les dons non identifiés (remplace le nom du donateur) */
  donorLabel?: string;
  montant: number;
  date: Date;
  /** Date à laquelle l'association a perçu le don (pour les dons non issus d'une transaction par libellé) */
  datePerception?: Date;
  /** Non requis pour les dons en nature (pas de versement d'argent) */
  modeVersement?: ModeVersement;
  natureDon: NatureDon;
  /** Description du bien/service pour les dons en nature ou mécénat */
  description?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const DONATEUR_ANONYME_ID = 'ANONYME';

export interface AssociationConfig {
  /** Données de l'association (émetteur type association) */
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
  /** Statut organisme d'intérêt général */
  statutOIG?: boolean;
  datePublicationJO?: string;
  /** Références CGI (ex: "articles 200 et 238 bis du code général des impôts") */
  referencesCGI?: string;
  /** ID du template PDF pour reçus fiscaux */
  pdfTemplateRecuFiscal?: string;
  /** Signataire des reçus fiscaux */
  signataireNom?: string;
  signataireQualite?: string;
  /** Informations légales complémentaires */
  formeJuridique?: string;
  prefectureDeclaration?: string;
  dateCreation?: string;
  numeroRecepisse?: string;
  /** Compteur séquentiel pour la numérotation des reçus fiscaux */
  nextReceiptNumber?: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Entrée dans le registre des reçus fiscaux émis */
export interface ReceiptEntry {
  id: string;
  /** Numéro séquentiel du reçu, ex : RECU-2026-0001 */
  numero: string;
  donateurId: string;
  donateurLabel: string;
  montant: number;
  /** Date du/des don(s) couverts (début de période) */
  date: string;
  /** Date d'émission du reçu */
  dateEmission: string;
  natureDon?: NatureDon;
  modeVersement?: ModeVersement;
  /** true si le reçu a été annulé */
  annule?: boolean;
  dateAnnulation?: string;
  /** Chemin relatif vers le PDF sauvegardé dans data/association_recus/ (pour rouvrir) */
  pdfPath?: string;
}

/** Mapping transactionId -> donateurId pour lier les transactions aux donateurs */
export interface DonateurTransactionMapping {
  [transactionId: string]: string;
}

export interface DonateurSerialized extends Omit<Donateur, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

export interface DonSerialized extends Omit<Don, 'date' | 'datePerception' | 'createdAt' | 'updatedAt'> {
  date: string;
  datePerception?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssociationConfigSerialized extends Omit<AssociationConfig, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}
