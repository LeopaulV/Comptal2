export type Periodicity = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'unique';

export interface RateDefinition {
  id: string;
  percentage: number;
  frequency: Periodicity;
  startDate: Date;
  endDate?: Date; // Optionnel : date de fin d'application du taux
}

export type FiscalCategory = 'LOYER' | 'SALAIRES' | 'ACHATS' | 'HONORAIRES' | 'VEHICULE' | 'DEPLACEMENT' | 'FOURNITURES' | 'ASSURANCES' | 'TELECOM' | 'AUTRES';

export const FISCAL_CATEGORIES: FiscalCategory[] = [
  'LOYER', 'SALAIRES', 'ACHATS', 'HONORAIRES', 'VEHICULE',
  'DEPLACEMENT', 'FOURNITURES', 'ASSURANCES', 'TELECOM', 'AUTRES',
];

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  periodicity: Periodicity;
  type: 'debit' | 'credit';
  startDate: Date;
  endDate?: Date;
  accountCode?: string;
  categoryCode?: string;
  fiscalCategory?: FiscalCategory;
  tvaRate?: number;
  color: string;
  advancedSettings?: {
    /** @deprecated Utiliser rates à la place */
    rate?: {
      percentage: number;
      frequency: Periodicity;
    };
    rates?: RateDefinition[]; // Liste des taux avec dates de validité
    creditIndicator?: {
      amount: number;
      frequency: Periodicity;
    };
  };
  isGroup?: boolean; // Indique si c'est un groupe
  children?: Subscription[]; // Sous-abonnements si c'est un groupe
}

export interface AccountProjectionConfig {
  accountCode: string;           // Code du compte (ex: "CCAL", "LDD")
  ceiling: number;               // Plafond max avant de passer au compte suivant (Infinity pour illimité)
  priority: number;              // Ordre de priorité (1 = plus prioritaire)
  initialBalance: number;        // Solde initial
  useAutoBalance: boolean;       // true = récupérer depuis transactions, false = manuel
}

export interface ProjectionConfig {
  startDate: Date;
  endDate: Date;
  initialBalance: number;           // Garde pour rétrocompatibilité
  accountConfigs?: AccountProjectionConfig[];  // Nouvelle config par compte
}

export interface ProjectionData {
  date: Date;
  balance: number;
  totalDebits: number;
  totalCredits: number;
  netFlow: number;
  cumulativeImpact: number;
}

export interface ProjectionDataByAccount {
  date: Date;
  accountBalances: Record<string, number>;  // { accountCode: balance }
  totalBalance: number;
  totalDebits: number;
  totalCredits: number;
  netFlow: number;
}

// Données de charges par catégorie (transactions réelles agrégées)
export interface CategoryMonthData {
  code: string;
  name: string;
  color: string;
  monthlyAmounts: Record<string, number>; // clé 'YYYY-MM' → montant total (abs)
  total: number;
  average: number; // total / nb mois avec données
}

export interface CategoryChargesData {
  categories: CategoryMonthData[];
  referencePeriod: { startDate: Date; endDate: Date };
  totalByMonth: Record<string, number>; // somme toutes catégories par mois
}

// Structure d'un projet complet
export interface Project {
  code: string; // Code unique du projet (ex: "PROJ001", "MAISON", "VOITURE")
  name: string; // Nom du projet
  subscriptions: Subscription[];
  projectionConfig: ProjectionConfig;
  createdAt: Date; // Date de création
  updatedAt: Date; // Date de dernière modification
  /** Mode de gestion des charges pour l'association */
  chargesMode?: 'manual' | 'categories';
  /** Config pour le mode catégories (période de référence + catégories sélectionnées) */
  categoryChargesConfig?: {
    referencePeriod: { startDate: Date; endDate: Date };
    selectedCategories: string[];
  };
}

// Taux sérialisé (dates en ISO string pour le JSON)
export interface RateDefinitionSerialized extends Omit<RateDefinition, 'startDate' | 'endDate'> {
  startDate: string;
  endDate?: string;
}

// Abonnement sérialisé (dates en ISO string pour le JSON)
export interface SubscriptionSerialized extends Omit<Subscription, 'startDate' | 'endDate' | 'children' | 'advancedSettings'> {
  startDate: string;
  endDate?: string;
  children?: SubscriptionSerialized[];
  advancedSettings?: {
    /** @deprecated Utiliser rates à la place */
    rate?: {
      percentage: number;
      frequency: Periodicity;
    };
    rates?: RateDefinitionSerialized[];
    creditIndicator?: {
      amount: number;
      frequency: Periodicity;
    };
  };
}

// Format de stockage JSON (sérialisé)
export interface ProjectSerialized {
  code: string;
  name: string;
  subscriptions: SubscriptionSerialized[];
  projectionConfig: {
    startDate: string; // ISO string
    endDate: string; // ISO string
    initialBalance: number;
    accountConfigs?: {
      accountCode: string;
      ceiling: number;
      priority: number;
      initialBalance: number;
      useAutoBalance: boolean;
    }[];
  };
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  chargesMode?: 'manual' | 'categories';
  categoryChargesConfig?: {
    referencePeriod: { startDate: string; endDate: string };
    selectedCategories: string[];
  };
}

// Configuration des projets (format fichier JSON)
export interface ProjectsConfig {
  [projectCode: string]: ProjectSerialized;
}
