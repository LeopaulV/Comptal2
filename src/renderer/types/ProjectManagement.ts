export type Periodicity = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'unique';

export interface RateDefinition {
  id: string;
  percentage: number;
  frequency: Periodicity;
  startDate: Date;
  endDate?: Date; // Optionnel : date de fin d'application du taux
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  periodicity: Periodicity;
  type: 'debit' | 'credit';
  startDate: Date;
  endDate?: Date; // Optionnel pour abonnements avec fin
  accountCode?: string; // Optionnel : compte associé
  categoryCode?: string; // Optionnel : catégorie associée
  color: string; // Couleur pour les graphiques (obligatoire)
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

// Structure d'un projet complet
export interface Project {
  code: string; // Code unique du projet (ex: "PROJ001", "MAISON", "VOITURE")
  name: string; // Nom du projet
  subscriptions: Subscription[];
  projectionConfig: ProjectionConfig;
  createdAt: Date; // Date de création
  updatedAt: Date; // Date de dernière modification
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
}

// Configuration des projets (format fichier JSON)
export interface ProjectsConfig {
  [projectCode: string]: ProjectSerialized;
}
