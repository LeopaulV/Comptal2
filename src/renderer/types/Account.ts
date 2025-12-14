// Types pour les comptes bancaires

export interface Account {
  code: string; // AVL, CCAL, N26, etc.
  name: string; // Nom complet du compte
  color: string; // Couleur hexadécimale pour l'affichage
}

export interface AccountsConfig {
  [key: string]: Omit<Account, 'code'>;
}

export interface AccountBalance {
  accountCode: string;
  accountName: string;
  balance: number;
  color: string;
  lastUpdate?: Date;
}

export interface AccountSummary extends AccountBalance {
  transactionCount: number;
  income: number;
  expenses: number;
}

