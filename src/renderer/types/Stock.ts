export type TypeArticle = 'immobilisation' | 'stock' | 'consommable' | 'achat_ponctuel';

export type TypeImmobilisation =
  | 'materiel_informatique'
  | 'materiel_bureau'
  | 'outillage'
  | 'vehicule'
  | 'mobilier'
  | 'logiciel'
  | 'autre';

export type MethodeAmortissement = 'lineaire' | 'degressif' | 'non_amortissable';
export type StatutArticle = 'actif' | 'cede' | 'mis_au_rebut';
export type TypeCategorie = 'materiel' | 'achat' | 'mixte';
export type ModePaiementAchat = 'virement' | 'cheque' | 'especes' | 'cb' | 'prelevement' | 'autre';
export type TypeMouvementStock = 'entree' | 'sortie' | 'ajustement';

export interface StockCategorie {
  id: string;
  nom: string;
  description?: string;
  couleur?: string;
  type: TypeCategorie;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockCategorieSerialized extends Omit<StockCategorie, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

export interface ArticleStock {
  id: string;
  categorieId?: string;
  designation: string;
  reference?: string;
  type: TypeArticle;
  typeImmobilisation?: TypeImmobilisation;
  valeurAcquisitionHT: number;
  tauxTVA: number;
  dateAcquisition: Date;
  fournisseur?: string;
  factureRef?: string;
  modePaiement?: ModePaiementAchat;
  dureeAmortissement?: number;
  methodeAmortissement?: MethodeAmortissement;
  valeurResiduelle?: number;
  quantite?: number;
  unite?: string;
  seuilAlerte?: number;
  /** Quantité nécessaire (saisi par l'utilisateur) */
  besoin?: number;
  /** Nombre d'éléments contenus dans une référence */
  nbElementsParRef?: number;
  /** Consommation hebdomadaire par semaine ISO (clé = "YYYY-Www") */
  consommationHebdo?: Record<string, number>;
  /** Couleur d'affichage pour l'article (inventaire, graphiques) */
  couleur?: string;
  /** Override nb d'années possédées pour l'amortissement */
  anneesDetention?: number;
  statut: StatutArticle;
  dateCession?: Date;
  valeurCession?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArticleStockSerialized
  extends Omit<ArticleStock, 'dateAcquisition' | 'dateCession' | 'createdAt' | 'updatedAt'> {
  dateAcquisition: string;
  dateCession?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MouvementStock {
  id: string;
  articleId: string;
  type: TypeMouvementStock;
  quantite: number;
  prixUnitaire?: number;
  date: Date;
  motif?: string;
  reference?: string;
}

export interface MouvementStockSerialized extends Omit<MouvementStock, 'date'> {
  date: string;
}

export interface AchatRegistreEntry {
  id: string;
  date: Date;
  designation: string;
  fournisseur: string;
  referenceFacture: string;
  categorie: string;
  modePaiement: ModePaiementAchat;
  montantHT: number;
  tva: number;
  montantTTC: number;
}
