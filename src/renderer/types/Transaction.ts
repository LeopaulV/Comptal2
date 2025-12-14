// Types pour les transactions

export interface Transaction {
  id: string; // Identifiant unique
  date: Date; // Date de la transaction
  description: string; // Description/libellé
  amount: number; // Montant (négatif pour dépense, positif pour revenu)
  balance?: number; // Solde après transaction
  category?: string; // Code de catégorie (A, B, C, etc.)
  accountCode: string; // Code du compte (AVL, CCAL, N26, etc.)
  accountName?: string; // Nom du compte
  originalLine?: string; // Ligne CSV originale
}

export interface CSVTransaction {
  [key: string]: string | number | Date;
}

export interface TransactionFilter {
  accountCodes?: string[];
  categoryCodes?: string[];
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  searchTerm?: string;
  type?: 'all' | 'income' | 'expense';
}

export interface TransactionStats {
  totalTransactions: number;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  averageTransaction: number;
  largestIncome: Transaction | null;
  largestExpense: Transaction | null;
}

export interface MonthlyStats {
  month: string; // Format: YYYY-MM
  income: number;
  expenses: number;
  net: number;
  balance: number;
  transactionCount: number;
}

export interface AccountTransactions {
  accountCode: string;
  accountName: string;
  transactions: Transaction[];
  startDate: Date;
  endDate: Date;
}

