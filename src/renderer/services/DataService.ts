// Service principal pour la gestion et l'analyse des données

import { Transaction, TransactionFilter, TransactionStats, MonthlyStats } from '../types/Transaction';
import { AccountSummary } from '../types/Account';
import { CategorySummary } from '../types/Category';
import { CSVService } from './CSVService';
import { ConfigService } from './ConfigService';
import { ProfilePaths } from './ProfilePaths';
import { startOfMonth, startOfDay, startOfWeek, format, parse, differenceInDays, differenceInMonths, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, getWeek, getYear } from 'date-fns';
import { fr } from 'date-fns/locale';

/** Granularité de l'axe X pour les graphiques Finance Global */
export type ChartGranularity = 'day' | 'week' | 'month' | 'quarter' | 'semester' | 'year';

const GRANULARITY_ORDER: ChartGranularity[] = ['day', 'week', 'month', 'quarter', 'semester', 'year'];

/** Retourne la clé de période (triable) pour une date donnée (exporté pour ProjectionService) */
export function getPeriodKey(date: Date, granularity: ChartGranularity): string {
  const d = new Date(date);
  switch (granularity) {
    case 'day':
      return format(d, 'yyyy-MM-dd');
    case 'week': {
      const weekStart = startOfWeek(d, { weekStartsOn: 1 });
      return format(weekStart, 'yyyy-MM-dd');
    }
    case 'month':
      return format(d, 'yyyy-MM');
    case 'quarter': {
      const q = Math.ceil((d.getMonth() + 1) / 3);
      return `${d.getFullYear()}-Q${q}`;
    }
    case 'semester': {
      const s = d.getMonth() < 6 ? 1 : 2;
      return `${d.getFullYear()}-S${s}`;
    }
    case 'year':
      return String(d.getFullYear());
    default:
      return format(d, 'yyyy-MM');
  }
}

/** Retourne le libellé d'affichage pour une clé de période (exporté pour alignement projection/réalité) */
export function getPeriodLabel(key: string, granularity: ChartGranularity): string {
  try {
    switch (granularity) {
      case 'day':
        return format(parse(key, 'yyyy-MM-dd', new Date()), 'd MMM yyyy', { locale: fr });
      case 'week': {
        const d = parse(key, 'yyyy-MM-dd', new Date());
        const weekNum = getWeek(d, { weekStartsOn: 1, firstWeekContainsDate: 4 });
        return `Sem. ${weekNum} ${getYear(d)}`;
      }
      case 'month':
        return format(parse(key + '-01', 'yyyy-MM-dd', new Date()), 'MMM yyyy', { locale: fr });
      case 'quarter':
        return key.replace('-Q', ' T'); // "2025-Q1" -> "2025 T1"
      case 'semester':
        return key.replace('-S', ' S'); // "2025-S1" -> "2025 S1"
      case 'year':
        return key;
      default:
        return key;
    }
  } catch {
    return key;
  }
}

/** Trie les clés de période chronologiquement (exporté pour FinanceGlobal) */
export function sortPeriodKeys(keys: string[], granularity: ChartGranularity): string[] {
  return [...keys].sort((a, b) => {
    const dateA = parsePeriodKeyToDate(a, granularity);
    const dateB = parsePeriodKeyToDate(b, granularity);
    return dateA.getTime() - dateB.getTime();
  });
}

/** Parse une clé de période en Date (exporté pour FinanceGlobal) */
export function parsePeriodKeyToDate(key: string, granularity: ChartGranularity): Date {
  switch (granularity) {
    case 'day':
      return parse(key, 'yyyy-MM-dd', new Date());
    case 'week':
      return parse(key, 'yyyy-MM-dd', new Date());
    case 'month':
      return parse(key + '-01', 'yyyy-MM-dd', new Date());
    case 'quarter': {
      const [y, q] = key.split('-Q').map(Number);
      return new Date(y, (q - 1) * 3, 1);
    }
    case 'semester': {
      const [y, s] = key.split('-S').map(Number);
      return new Date(y, (s - 1) * 6, 1);
    }
    case 'year':
      return new Date(parseInt(key, 10), 0, 1);
    default:
      return new Date(key);
  }
}

/** Génère toutes les clés de période dans un intervalle [start, end] (exporté pour BilanFinancierChart, StockService) */
export function getPeriodKeysInRange(start: Date, end: Date, granularity: ChartGranularity): string[] {
  const s = startOfDay(start);
  const e = startOfDay(end);
  const keys = new Set<string>();

  if (granularity === 'day') {
    eachDayOfInterval({ start: s, end: e }).forEach(d => keys.add(getPeriodKey(d, granularity)));
  } else if (granularity === 'week') {
    eachWeekOfInterval({ start: s, end: e }, { weekStartsOn: 1 }).forEach(d => keys.add(getPeriodKey(d, granularity)));
  } else if (granularity === 'month') {
    eachMonthOfInterval({ start: s, end: e }).forEach(d => keys.add(getPeriodKey(d, granularity)));
  } else if (granularity === 'quarter' || granularity === 'semester' || granularity === 'year') {
    const current = new Date(s);
    while (current <= e) {
      keys.add(getPeriodKey(current, granularity));
      if (granularity === 'quarter') {
        current.setMonth(current.getMonth() + 3);
      } else if (granularity === 'semester') {
        current.setMonth(current.getMonth() + 6);
      } else {
        current.setFullYear(current.getFullYear() + 1);
      }
    }
  }

  return sortPeriodKeys(Array.from(keys), granularity);
}

export class DataService {
  private static transactions: Transaction[] = [];
  private static isLoaded = false;

  /**
   * Charge toutes les transactions
   */
  static async loadData(): Promise<void> {
    if (this.isLoaded) return;

    try {
      const dataDirectory = await ProfilePaths.getDataDirectory();
      this.transactions = await CSVService.loadAllTransactions(dataDirectory);
      // Accepter un tableau vide comme résultat valide (pas d'erreur)
      if (this.transactions.length === 0) {
        console.warn(`[DataService] Aucune transaction chargée. Le dossier ${dataDirectory} est vide ou n'existe pas.`);
      }
      this.isLoaded = true;
    } catch (error: any) {
      // En cas d'erreur, initialiser avec un tableau vide au lieu de lancer une erreur
      console.warn('[DataService] Erreur lors du chargement des données, utilisation d\'un tableau vide:', error.message);
      this.transactions = [];
      this.isLoaded = true;
    }
  }

  /**
   * Récupère toutes les transactions
   */
  static async getTransactions(): Promise<Transaction[]> {
    if (!this.isLoaded) {
      await this.loadData();
    }
    return this.transactions;
  }

  /**
   * Filtre les transactions avec une logique stricte et robuste
   */
  static async filterTransactions(filter: TransactionFilter): Promise<Transaction[]> {
    const transactions = await this.getTransactions();

    return transactions.filter(t => {
      // Filtre par compte (strict : si des comptes sont spécifiés, SEULS ceux-ci sont inclus)
      if (filter.accountCodes && filter.accountCodes.length > 0) {
        // Normaliser les codes pour éviter les problèmes d'espaces ou de casse
        const normalizedTransactionCode = (t.accountCode || '').trim().toUpperCase();
        const normalizedFilterCodes = filter.accountCodes
          .map(code => (code || '').trim().toUpperCase())
          .filter(code => code.length > 0); // Ignorer les codes vides
        
        if (normalizedFilterCodes.length === 0) {
          return false; // Si tous les codes filtrés sont invalides, exclure toutes les transactions
        }
        
        if (!normalizedFilterCodes.includes(normalizedTransactionCode)) {
          return false;
        }
      }

      // Filtre par catégorie (strict : si des catégories sont spécifiées, SEULES celles-ci sont incluses)
      // Note: Les transactions sans catégorie sont exclues uniquement si un filtre de catégorie est actif
      if (filter.categoryCodes && filter.categoryCodes.length > 0) {
        // Si la transaction n'a pas de catégorie, elle est exclue
        if (!t.category) {
          return false;
        }
        // Si la catégorie n'est pas dans la liste, elle est exclue
        if (!filter.categoryCodes.includes(t.category)) {
          return false;
        }
      }

      // Filtre par date (strict : inclusion stricte dans la plage)
      if (filter.startDate) {
        // Normaliser les dates pour comparaison (début de journée)
        const transactionDate = new Date(t.date);
        transactionDate.setHours(0, 0, 0, 0);
        const startDate = new Date(filter.startDate);
        startDate.setHours(0, 0, 0, 0);
        
        if (transactionDate < startDate) {
          return false;
        }
      }
      
      if (filter.endDate) {
        // Normaliser les dates pour comparaison (fin de journée)
        const transactionDate = new Date(t.date);
        transactionDate.setHours(23, 59, 59, 999);
        const endDate = new Date(filter.endDate);
        endDate.setHours(23, 59, 59, 999);
        
        if (transactionDate > endDate) {
          return false;
        }
      }

      // Filtre par montant (strict)
      if (filter.minAmount !== undefined && t.amount < filter.minAmount) {
        return false;
      }
      if (filter.maxAmount !== undefined && t.amount > filter.maxAmount) {
        return false;
      }

      // Filtre par type (strict)
      if (filter.type === 'income' && t.amount <= 0) {
        return false;
      }
      if (filter.type === 'expense' && t.amount >= 0) {
        return false;
      }

      // Recherche dans la description (insensible à la casse et aux espaces multiples)
      if (filter.searchTerm) {
        const term = filter.searchTerm.trim().toLowerCase();
        // Ignorer les termes vides
        if (term.length === 0) {
          return true;
        }
        
        const description = t.description.toLowerCase();
        // Recherche stricte : le terme doit être présent dans la description
        if (!description.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Calcule les statistiques des transactions
   */
  static async getStats(filter?: TransactionFilter): Promise<TransactionStats> {
    const transactions = filter 
      ? await this.filterTransactions(filter)
      : await this.getTransactions();

    // Exclure les catégories "X" (TIC) de tous les calculs
    const validTransactions = transactions.filter(t => t.category !== 'X');

    // Revenus (inclut "Y" = Salaire)
    const income = validTransactions.filter(t => t.amount > 0);
    
    // Dépenses (exclure "Y" = Salaire, déjà exclu car négatif uniquement)
    const expenses = validTransactions.filter(t => t.amount < 0);

    const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = Math.abs(expenses.reduce((sum, t) => sum + t.amount, 0));

    const largestIncome = income.length > 0 
      ? income.reduce((max, t) => t.amount > max.amount ? t : max)
      : null;

    const largestExpense = expenses.length > 0
      ? expenses.reduce((max, t) => Math.abs(t.amount) > Math.abs(max.amount) ? t : max)
      : null;

    return {
      totalTransactions: validTransactions.length,
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      averageTransaction: validTransactions.length > 0 
        ? validTransactions.reduce((sum, t) => sum + t.amount, 0) / validTransactions.length
        : 0,
      largestIncome,
      largestExpense,
    };
  }

  /**
   * Calcule les statistiques mensuelles
   */
  static async getMonthlyStats(filter?: TransactionFilter): Promise<MonthlyStats[]> {
    const transactions = filter 
      ? await this.filterTransactions(filter)
      : await this.getTransactions();

    // Exclure les catégories "X" (TIC) des statistiques mensuelles
    const validTransactions = transactions.filter(t => t.category !== 'X');

    const monthlyMap = new Map<string, MonthlyStats>();

    for (const t of validTransactions) {
      const monthKey = format(startOfMonth(t.date), 'yyyy-MM');
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          month: monthKey,
          income: 0,
          expenses: 0,
          net: 0,
          balance: 0,
          transactionCount: 0,
        });
      }

      const stats = monthlyMap.get(monthKey)!;
      stats.transactionCount++;
      
      if (t.amount > 0) {
        stats.income += t.amount;
      } else {
        stats.expenses += Math.abs(t.amount);
      }
      
      stats.net = stats.income - stats.expenses;
      stats.balance = t.balance || 0;
    }

    return Array.from(monthlyMap.values()).sort((a, b) => 
      a.month.localeCompare(b.month)
    );
  }

  /**
   * Calcule les résumés par compte
   */
  static async getAccountSummaries(): Promise<AccountSummary[]> {
    const transactions = await this.getTransactions();
    const accounts = await ConfigService.loadAccounts();
    
    const accountMap = new Map<string, AccountSummary>();

    for (const t of transactions) {
      if (!accountMap.has(t.accountCode)) {
        const accountConfig = accounts[t.accountCode];
        accountMap.set(t.accountCode, {
          accountCode: t.accountCode,
          accountName: accountConfig?.name || t.accountName || t.accountCode,
          balance: 0,
          color: accountConfig?.color || '#cccccc',
          transactionCount: 0,
          income: 0,
          expenses: 0,
        });
      }

      const summary = accountMap.get(t.accountCode)!;
      summary.transactionCount++;
      summary.balance = t.balance || summary.balance;
      
      if (t.amount > 0) {
        summary.income += t.amount;
      } else {
        summary.expenses += Math.abs(t.amount);
      }
    }

    return Array.from(accountMap.values());
  }

  /**
   * Calcule les résumés par catégorie
   */
  static async getCategorySummaries(filter?: TransactionFilter): Promise<CategorySummary[]> {
    const transactions = filter 
      ? await this.filterTransactions(filter)
      : await this.getTransactions();
    
    const categories = await ConfigService.loadCategories();
    const categoryMap = new Map<string, CategorySummary>();

    // Filtrer : exclure uniquement "X" (TIC), inclure toutes les transactions (revenus et dépenses)
    const validTransactions = transactions.filter(t => 
      t.category && 
      t.category !== 'X'
    );

    // Total des montants absolus (dénominateur des parts % — inchangé sémantiquement)
    const totalAbsAmount = validTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const categoryAbsAmount = new Map<string, number>();

    for (const t of validTransactions) {
      if (!categoryMap.has(t.category!)) {
        const categoryConfig = categories[t.category!];
        categoryMap.set(t.category!, {
          categoryCode: t.category!,
          categoryName: categoryConfig?.name || t.category!,
          color: categoryConfig?.color || '#cccccc',
          totalAmount: 0,
          transactionCount: 0,
          percentage: 0,
        });
      }

      const summary = categoryMap.get(t.category!)!;
      summary.totalAmount += t.amount;
      summary.transactionCount++;
      const code = t.category!;
      categoryAbsAmount.set(code, (categoryAbsAmount.get(code) || 0) + Math.abs(t.amount));
    }

    // Parts % : volume absolu par catégorie / volume total (la colonne « somme » reste algébrique)
    for (const summary of categoryMap.values()) {
      const absSum = categoryAbsAmount.get(summary.categoryCode) || 0;
      summary.percentage = totalAbsAmount > 0 ? (absSum / totalAbsAmount) * 100 : 0;
    }

    return Array.from(categoryMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }

  /**
   * Calcule les données mensuelles par catégorie pour le graphique
   */
  static async getMonthlyCategoryData(): Promise<{
    months: string[];
    categories: string[];
    monthlyData: number[][];
    categoryColors: Record<string, string>;
  }> {
    const transactions = await this.getTransactions();
    const categories = await ConfigService.loadCategories();

    // Exclure uniquement "X" (TIC), inclure toutes les transactions (revenus et dépenses)
    const validTransactions = transactions.filter(
      t => t.category && t.category !== 'X'
    );

    // Obtenir tous les mois uniques et les trier chronologiquement
    const monthsSet = new Set<string>();
    validTransactions.forEach(t => {
      const monthKey = format(startOfMonth(t.date), 'MMM yyyy');
      monthsSet.add(monthKey);
    });
    // Trier chronologiquement en convertissant en dates puis en strings
    const months = Array.from(monthsSet).sort((a, b) => {
      const dateA = parse(a, 'MMM yyyy', new Date());
      const dateB = parse(b, 'MMM yyyy', new Date());
      return dateA.getTime() - dateB.getTime();
    });

    // Obtenir toutes les catégories uniques
    const categoriesSet = new Set<string>();
    validTransactions.forEach(t => {
      if (t.category) categoriesSet.add(t.category);
    });
    const categoryList = Array.from(categoriesSet);

    // Créer un map pour les données mensuelles par catégorie
    const monthlyDataMap = new Map<string, Map<string, number>>();
    
    validTransactions.forEach(t => {
      const monthKey = format(startOfMonth(t.date), 'MMM yyyy');
      if (!monthlyDataMap.has(t.category!)) {
        monthlyDataMap.set(t.category!, new Map());
      }
      const categoryMap = monthlyDataMap.get(t.category!)!;
      const currentAmount = categoryMap.get(monthKey) || 0;
      categoryMap.set(monthKey, currentAmount + t.amount); // amount peut être positif (revenus) ou négatif (dépenses)
    });

    // Construire le tableau 2D de données
    const monthlyData: number[][] = categoryList.map(category => {
      const categoryMap = monthlyDataMap.get(category) || new Map();
      return months.map(month => categoryMap.get(month) || 0);
    });

    // Créer le map de couleurs
    const categoryColors: Record<string, string> = {};
    categoryList.forEach(cat => {
      const catConfig = categories[cat];
      categoryColors[catConfig?.name || cat] = catConfig?.color || '#808080';
    });

    // Convertir les codes de catégorie en noms
    const categoryNames = categoryList.map(cat => categories[cat]?.name || cat);

    return {
      months,
      categories: categoryNames,
      monthlyData,
      categoryColors,
    };
  }

  /**
   * Calcule les données mensuelles par compte pour le graphique de solde
   */
  static async getMonthlyAccountData(): Promise<{
    months: string[];
    accounts: string[];
    monthlyData: number[][];
    accountColors: Record<string, string>;
  }> {
    const transactions = await this.getTransactions();
    const accounts = await ConfigService.loadAccounts();

    // Obtenir tous les mois uniques et les trier chronologiquement
    const monthsSet = new Set<string>();
    transactions.forEach(t => {
      const monthKey = format(startOfMonth(t.date), 'MMM yyyy');
      monthsSet.add(monthKey);
    });
    // Trier chronologiquement en convertissant en dates puis en strings
    const months = Array.from(monthsSet).sort((a, b) => {
      const dateA = parse(a, 'MMM yyyy', new Date());
      const dateB = parse(b, 'MMM yyyy', new Date());
      return dateA.getTime() - dateB.getTime();
    });

    // Obtenir tous les comptes uniques
    const accountsSet = new Set<string>();
    transactions.forEach(t => accountsSet.add(t.accountCode));
    const accountList = Array.from(accountsSet);

    // Trouver le dernier solde par compte et par mois
    const monthlyBalances = new Map<string, Map<string, number>>();
    
    // Trier les transactions par date pour chaque compte
    const transactionsByAccount = new Map<string, Transaction[]>();
    transactions.forEach(t => {
      if (!transactionsByAccount.has(t.accountCode)) {
        transactionsByAccount.set(t.accountCode, []);
      }
      transactionsByAccount.get(t.accountCode)!.push(t);
    });
    
    // Pour chaque compte, trouver le solde pour chaque mois
    accountList.forEach(account => {
      const accountTransactions = transactionsByAccount.get(account) || [];
      // Trier par date
      accountTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());
      
      const accountMap = new Map<string, number>();
      
      // Pour chaque mois, trouver le solde approprié
      months.forEach(month => {
        const monthDate = parse(month, 'MMM yyyy', new Date());
        const monthStart = startOfMonth(monthDate);
        
        // Trouver les transactions dans ce mois
        const monthTransactions = accountTransactions.filter(t => {
          const tDate = startOfMonth(t.date);
          return tDate.getTime() === monthStart.getTime();
        });
        
        if (monthTransactions.length > 0) {
          // Trier par jour du mois pour privilégier les dates proches du 1er
          monthTransactions.sort((a, b) => {
            const dayA = a.date.getDate();
            const dayB = b.date.getDate();
            return dayA - dayB;
          });
          
          // Chercher d'abord les soldes positifs dans les 15 premiers jours
          const earlyMonthTransactions = monthTransactions.filter(t => t.date.getDate() <= 15);
          const positiveEarlySoldes = earlyMonthTransactions
            .filter(t => t.balance !== undefined && t.balance !== null && t.balance > 0)
            .map(t => t.balance!);
          
          if (positiveEarlySoldes.length > 0) {
            // Prendre le solde positif le plus élevé du début du mois
            accountMap.set(month, Math.max(...positiveEarlySoldes));
          } else if (earlyMonthTransactions.length > 0) {
            // Si pas de solde positif au début du mois, prendre le premier solde
            const firstBalance = earlyMonthTransactions.find(t => t.balance !== undefined && t.balance !== null)?.balance;
            if (firstBalance !== undefined) {
              accountMap.set(month, firstBalance);
            }
          } else {
            // Chercher des soldes positifs dans tout le mois
            const positiveSoldes = monthTransactions
              .filter(t => t.balance !== undefined && t.balance !== null && t.balance > 0)
              .map(t => t.balance!);
            
            if (positiveSoldes.length > 0) {
              accountMap.set(month, Math.max(...positiveSoldes));
            } else if (monthTransactions.length > 0) {
              // Prendre le premier solde du mois
              const firstBalance = monthTransactions.find(t => t.balance !== undefined && t.balance !== null)?.balance;
              if (firstBalance !== undefined) {
                accountMap.set(month, firstBalance);
              }
            }
          }
        } else {
          // Si pas de données pour ce mois, chercher le dernier solde connu avant ce mois
          const previousTransactions = accountTransactions.filter(t => {
            const tDate = startOfMonth(t.date);
            return tDate.getTime() < monthStart.getTime();
          });
          
          if (previousTransactions.length > 0) {
            // Prendre le dernier solde connu
            const lastTransaction = previousTransactions[previousTransactions.length - 1];
            if (lastTransaction.balance !== undefined && lastTransaction.balance !== null) {
              accountMap.set(month, lastTransaction.balance);
            }
          }
        }
      });
      
      monthlyBalances.set(account, accountMap);
    });

    // Construire le tableau 2D de données en remplissant les mois manquants avec le dernier solde connu
    const monthlyData: number[][] = accountList.map(account => {
      const accountMap = monthlyBalances.get(account) || new Map();
      let lastKnownBalance = 0;
      return months.map(month => {
        const balance = accountMap.get(month);
        if (balance !== undefined) {
          lastKnownBalance = balance;
          return balance;
        }
        // Si le mois est vide, utiliser le dernier solde connu
        return lastKnownBalance;
      });
    });

    // Créer le map de couleurs
    const accountColors: Record<string, string> = {};
    accountList.forEach(acc => {
      const accConfig = accounts[acc];
      accountColors[accConfig?.name || acc] = accConfig?.color || '#808080';
    });

    // Convertir les codes de compte en noms
    const accountNames = accountList.map(acc => accounts[acc]?.name || acc);

    return {
      months,
      accounts: accountNames,
      monthlyData,
      accountColors,
    };
  }

  /**
   * Calcule les données par catégorie pour le graphique avec granularité et plage configurables
   */
  static async getCategoryChartData(
    granularity: ChartGranularity = 'month',
    dateFrom?: Date | null,
    dateTo?: Date | null
  ): Promise<{
    months: string[];
    periodKeys: string[];
    categories: string[];
    monthlyData: number[][];
    categoryColors: Record<string, string>;
  }> {
    const transactions = await this.getTransactions();
    const categories = await ConfigService.loadCategories();

    const validTransactions = transactions.filter(
      t => t.category && t.category !== 'X'
    );

    let filtered = validTransactions;
    let periodKeys: string[];

    if (dateFrom && dateTo) {
      filtered = validTransactions.filter(t => {
        const d = t.date.getTime();
        if (d < startOfDay(dateFrom).getTime()) return false;
        if (d > startOfDay(dateTo).getTime()) return false;
        return true;
      });
      periodKeys = getPeriodKeysInRange(dateFrom, dateTo, granularity);
    } else {
      const periodsSet = new Set<string>();
      filtered.forEach(t => periodsSet.add(getPeriodKey(t.date, granularity)));
      periodKeys = sortPeriodKeys(Array.from(periodsSet), granularity);
    }
    const months = periodKeys.map(k => getPeriodLabel(k, granularity));

    const categoriesSet = new Set<string>();
    filtered.forEach(t => {
      if (t.category) categoriesSet.add(t.category);
    });
    const categoryList = Array.from(categoriesSet);

    const dataMap = new Map<string, Map<string, number>>();
    filtered.forEach(t => {
      const periodKey = getPeriodKey(t.date, granularity);
      if (!dataMap.has(t.category!)) {
        dataMap.set(t.category!, new Map());
      }
      const catMap = dataMap.get(t.category!)!;
      const current = catMap.get(periodKey) || 0;
      catMap.set(periodKey, current + t.amount);
    });

    const monthlyData: number[][] = categoryList.map(cat => {
      const catMap = dataMap.get(cat) || new Map();
      return periodKeys.map(k => catMap.get(k) || 0);
    });

    const categoryColors: Record<string, string> = {};
    categoryList.forEach(cat => {
      const catConfig = categories[cat];
      categoryColors[catConfig?.name || cat] = catConfig?.color || '#808080';
    });

    const categoryNames = categoryList.map(cat => categories[cat]?.name || cat);

    return {
      months,
      periodKeys,
      categories: categoryNames,
      monthlyData,
      categoryColors,
    };
  }

  /**
   * Calcule les données Bilan (crédits et débits séparés par catégorie et période)
   */
  static async getBilanChartData(
    granularity: ChartGranularity = 'month',
    dateFrom?: Date | null,
    dateTo?: Date | null
  ): Promise<{
    periodKeys: string[];
    months: string[];
    categoriesWithCredits: string[];
    categoriesWithDebits: string[];
    creditsByCategory: Record<string, number[]>;
    debitsByCategory: Record<string, number[]>;
    categoryColors: Record<string, string>;
  }> {
    const transactions = await this.getTransactions();
    const categoriesConfig = await ConfigService.loadCategories();

    const validTransactions = transactions.filter(
      t => t.category && t.category !== 'X'
    );

    let filtered = validTransactions;
    let periodKeys: string[];

    if (dateFrom && dateTo) {
      filtered = validTransactions.filter(t => {
        const d = t.date.getTime();
        if (d < startOfDay(dateFrom).getTime()) return false;
        if (d > startOfDay(dateTo).getTime()) return false;
        return true;
      });
      periodKeys = getPeriodKeysInRange(dateFrom, dateTo, granularity);
    } else {
      const periodsSet = new Set<string>();
      filtered.forEach(t => periodsSet.add(getPeriodKey(t.date, granularity)));
      periodKeys = sortPeriodKeys(Array.from(periodsSet), granularity);
    }
    const months = periodKeys.map(k => getPeriodLabel(k, granularity));

    const creditsMap = new Map<string, Map<string, number>>();
    const debitsMap = new Map<string, Map<string, number>>();

    filtered.forEach(t => {
      const periodKey = getPeriodKey(t.date, granularity);
      const cat = t.category!;
      if (t.amount > 0) {
        if (!creditsMap.has(cat)) creditsMap.set(cat, new Map());
        const m = creditsMap.get(cat)!;
        m.set(periodKey, (m.get(periodKey) || 0) + t.amount);
      } else if (t.amount < 0) {
        if (!debitsMap.has(cat)) debitsMap.set(cat, new Map());
        const m = debitsMap.get(cat)!;
        m.set(periodKey, (m.get(periodKey) || 0) + t.amount);
      }
    });

    const categoryList = Array.from(new Set([...creditsMap.keys(), ...debitsMap.keys()]));
    const categoryNames = categoryList.map(cat => categoriesConfig[cat]?.name || cat);

    const categoriesWithCredits = categoryList.filter(cat => {
      const m = creditsMap.get(cat);
      return m && Array.from(m.values()).some(v => v > 0);
    }).map(cat => categoriesConfig[cat]?.name || cat);

    const categoriesWithDebits = categoryList.filter(cat => {
      const m = debitsMap.get(cat);
      return m && Array.from(m.values()).some(v => v < 0);
    }).map(cat => categoriesConfig[cat]?.name || cat);

    const creditsByCategory: Record<string, number[]> = {};
    const debitsByCategory: Record<string, number[]> = {};
    categoryNames.forEach((name, idx) => {
      const code = categoryList[idx];
      const cMap = creditsMap.get(code) || new Map();
      creditsByCategory[name] = periodKeys.map(k => cMap.get(k) || 0);
      const dMap = debitsMap.get(code) || new Map();
      debitsByCategory[name] = periodKeys.map(k => dMap.get(k) || 0);
    });

    const categoryColors: Record<string, string> = {};
    categoryList.forEach(cat => {
      const name = categoriesConfig[cat]?.name || cat;
      categoryColors[name] = categoriesConfig[cat]?.color || '#808080';
    });

    return {
      periodKeys,
      months,
      categoriesWithCredits,
      categoriesWithDebits,
      creditsByCategory,
      debitsByCategory,
      categoryColors,
    };
  }

  /**
   * Calcule les données par compte pour le graphique de solde avec granularité et plage configurables
   */
  static async getAccountChartData(
    granularity: ChartGranularity = 'month',
    dateFrom?: Date | null,
    dateTo?: Date | null
  ): Promise<{
    months: string[];
    accounts: string[];
    monthlyData: number[][];
    accountColors: Record<string, string>;
  }> {
    const transactions = await this.getTransactions();
    const accounts = await ConfigService.loadAccounts();

    let periodKeys: string[];
    if (dateFrom && dateTo) {
      periodKeys = getPeriodKeysInRange(dateFrom, dateTo, granularity);
    } else {
      const periodsSet = new Set<string>();
      transactions.forEach(t => periodsSet.add(getPeriodKey(t.date, granularity)));
      periodKeys = sortPeriodKeys(Array.from(periodsSet), granularity);
    }
    const months = periodKeys.map(k => getPeriodLabel(k, granularity));

    const accountsSet = new Set<string>();
    transactions.forEach(t => accountsSet.add(t.accountCode));
    const accountList = Array.from(accountsSet);

    const transactionsByAccount = new Map<string, Transaction[]>();
    transactions.forEach(t => {
      if (!transactionsByAccount.has(t.accountCode)) {
        transactionsByAccount.set(t.accountCode, []);
      }
      transactionsByAccount.get(t.accountCode)!.push(t);
    });

    accountList.forEach(acc => {
      const list = transactionsByAccount.get(acc) || [];
      list.sort((a, b) => a.date.getTime() - b.date.getTime());
    });

    const balanceMap = new Map<string, Map<string, number>>();

    accountList.forEach(account => {
      const accountTransactions = transactionsByAccount.get(account) || [];
      const accountMap = new Map<string, number>();

      periodKeys.forEach(periodKey => {
        const periodStart = parsePeriodKeyToDate(periodKey, granularity);
        let periodEnd: Date;
        if (granularity === 'day') {
          periodEnd = new Date(periodStart);
          periodEnd.setHours(23, 59, 59, 999);
        } else if (granularity === 'week') {
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodEnd.getDate() + 6);
          periodEnd.setHours(23, 59, 59, 999);
        } else if (granularity === 'month') {
          periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0, 23, 59, 59, 999);
        } else if (granularity === 'quarter') {
          const [, q] = periodKey.split('-Q').map(Number);
          periodEnd = new Date(periodStart.getFullYear(), q * 3, 0, 23, 59, 59, 999);
        } else if (granularity === 'semester') {
          const [, s] = periodKey.split('-S').map(Number);
          periodEnd = new Date(periodStart.getFullYear(), s * 6, 0, 23, 59, 59, 999);
        } else {
          periodEnd = new Date(periodStart.getFullYear(), 11, 31, 23, 59, 59, 999);
        }

        const periodEndTime = periodEnd.getTime();
        const txsUpTo = accountTransactions.filter(t => t.date.getTime() <= periodEndTime);

        let lastBalance: number | undefined;
        for (let i = txsUpTo.length - 1; i >= 0; i--) {
          if (txsUpTo[i].balance !== undefined && txsUpTo[i].balance !== null) {
            lastBalance = txsUpTo[i].balance!;
            break;
          }
        }

        if (lastBalance !== undefined) {
          accountMap.set(periodKey, lastBalance);
        } else {
          const prevTxs = accountTransactions.filter(t => t.date.getTime() < periodStart.getTime());
          if (prevTxs.length > 0) {
            for (let i = prevTxs.length - 1; i >= 0; i--) {
              if (prevTxs[i].balance !== undefined && prevTxs[i].balance !== null) {
                accountMap.set(periodKey, prevTxs[i].balance!);
                break;
              }
            }
          }
        }
      });

      balanceMap.set(account, accountMap);
    });

    const monthlyData: number[][] = accountList.map(account => {
      const accountMap = balanceMap.get(account) || new Map();
      let lastKnown = 0;
      return periodKeys.map(k => {
        const v = accountMap.get(k);
        if (v !== undefined) {
          lastKnown = v;
          return v;
        }
        return lastKnown;
      });
    });

    const accountColors: Record<string, string> = {};
    accountList.forEach(acc => {
      const accConfig = accounts[acc];
      accountColors[accConfig?.name || acc] = accConfig?.color || '#808080';
    });

    const accountNames = accountList.map(acc => accounts[acc]?.name || acc);

    return {
      months,
      accounts: accountNames,
      monthlyData,
      accountColors,
    };
  }

  /**
   * Retourne le niveau de granularité suivant (zoom plus = plus de détails)
   */
  static getNextGranularity(current: ChartGranularity): ChartGranularity | null {
    const idx = GRANULARITY_ORDER.indexOf(current);
    return idx > 0 ? GRANULARITY_ORDER[idx - 1]! : null;
  }

  /**
   * Retourne le niveau de granularité précédent (zoom moins = moins de détails)
   */
  static getPreviousGranularity(current: ChartGranularity): ChartGranularity | null {
    const idx = GRANULARITY_ORDER.indexOf(current);
    return idx >= 0 && idx < GRANULARITY_ORDER.length - 1 ? GRANULARITY_ORDER[idx + 1]! : null;
  }

  /**
   * Calcule les soldes de tous les comptes sur une période avec granularité dynamique
   * - Si période < 1 mois : points quotidiens
   * - Si période < 4 mois : points hebdomadaires
   * - Si période >= 4 mois : points mensuels
   * @param accountCodes - Codes de comptes à inclure (optionnel, si non fourni, tous les comptes sont inclus)
   */
  static async getAccountBalancesOverPeriod(
    startDate: Date,
    endDate: Date,
    accountCodes?: string[]
  ): Promise<{
    periods: string[];
    accounts: string[];
    balanceData: number[][];
    accountColors: Record<string, string>;
    granularity: 'day' | 'week' | 'month';
  }> {
    const transactions = await this.getTransactions();
    const accounts = await ConfigService.loadAccounts();

    // Normaliser les dates
    const start = startOfDay(startDate);
    const end = startOfDay(endDate);
    
    // Déterminer la granularité selon la durée de la période
    const daysDiff = differenceInDays(end, start);
    const monthsDiff = differenceInMonths(end, start);
    
    let granularity: 'day' | 'week' | 'month';
    let periodDates: Date[];
    let periodLabels: string[];
    
    if (daysDiff < 30) {
      // Moins de 1 mois : granularité quotidienne
      granularity = 'day';
      periodDates = eachDayOfInterval({ start, end });
      periodLabels = periodDates.map(date => format(date, 'dd/MM', { locale: fr }));
    } else if (monthsDiff < 4) {
      // Moins de 4 mois : granularité hebdomadaire
      granularity = 'week';
      periodDates = eachWeekOfInterval(
        { start, end },
        { weekStartsOn: 1 } // Semaine commence le lundi
      );
      periodLabels = periodDates.map((_, index) => `Sem ${index + 1}`);
    } else {
      // 4 mois ou plus : granularité mensuelle
      granularity = 'month';
      periodDates = eachMonthOfInterval({ start, end });
      periodLabels = periodDates.map(date => format(date, 'MMM yyyy', { locale: fr }));
    }

    // Obtenir tous les comptes uniques
    const accountsSet = new Set<string>();
    transactions.forEach(t => accountsSet.add(t.accountCode));
    
    // Filtrer les comptes selon le paramètre accountCodes si fourni
    let accountList = Array.from(accountsSet);
    if (accountCodes && accountCodes.length > 0) {
      // Normaliser les codes pour la comparaison
      const normalizedFilterCodes = accountCodes.map(code => (code || '').trim().toUpperCase());
      accountList = accountList.filter(acc => 
        normalizedFilterCodes.includes((acc || '').trim().toUpperCase())
      );
    }

    // Grouper les transactions par compte et les trier par date
    const transactionsByAccount = new Map<string, Transaction[]>();
    transactions.forEach(t => {
      if (!transactionsByAccount.has(t.accountCode)) {
        transactionsByAccount.set(t.accountCode, []);
      }
      transactionsByAccount.get(t.accountCode)!.push(t);
    });

    // Pour chaque compte, trier les transactions par date
    accountList.forEach(account => {
      const accountTransactions = transactionsByAccount.get(account) || [];
      accountTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());
    });

    // Calculer les soldes pour chaque période et chaque compte
    const balanceData: number[][] = accountList.map(account => {
      const accountTransactions = transactionsByAccount.get(account) || [];
      const accountBalances: number[] = [];
      let lastKnownBalance = 0;

      periodDates.forEach((periodDate) => {
        let periodEnd: Date;
        
        // Déterminer la fin de la période selon la granularité
        if (granularity === 'day') {
          // Pour les jours, la période est juste ce jour-là
          periodEnd = new Date(periodDate);
          periodEnd.setHours(23, 59, 59, 999);
        } else if (granularity === 'week') {
          // Pour les semaines, periodDate est déjà le début de la semaine
          periodEnd = new Date(periodDate);
          periodEnd.setDate(periodEnd.getDate() + 6); // Ajouter 6 jours pour avoir la fin de la semaine
          periodEnd.setHours(23, 59, 59, 999);
        } else {
          // Mois : prendre la fin du mois
          periodEnd = new Date(periodDate);
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          periodEnd.setDate(0); // Dernier jour du mois
          periodEnd.setHours(23, 59, 59, 999);
        }

        // Trouver le dernier solde connu jusqu'à la fin de cette période
        const transactionsUpToPeriod = accountTransactions.filter(t => {
          const tDate = startOfDay(t.date);
          const periodEndNormalized = startOfDay(periodEnd);
          return tDate <= periodEndNormalized;
        });

        if (transactionsUpToPeriod.length > 0) {
          // Trouver la transaction la plus récente avec un solde défini
          let latestTransaction: Transaction | null = null;
          for (let i = transactionsUpToPeriod.length - 1; i >= 0; i--) {
            const t = transactionsUpToPeriod[i];
            if (t.balance !== undefined && t.balance !== null) {
              latestTransaction = t;
              break;
            }
          }

          if (latestTransaction) {
            lastKnownBalance = latestTransaction.balance!;
          }
        }

        accountBalances.push(lastKnownBalance);
      });

      return accountBalances;
    });

    // Créer le map de couleurs
    const accountColors: Record<string, string> = {};
    accountList.forEach(acc => {
      const accConfig = accounts[acc];
      accountColors[accConfig?.name || acc] = accConfig?.color || '#808080';
    });

    // Convertir les codes de compte en noms
    const accountNames = accountList.map(acc => accounts[acc]?.name || acc);

    return {
      periods: periodLabels,
      accounts: accountNames,
      balanceData,
      accountColors,
      granularity,
    };
  }

  /**
   * Calcule les soldes de tous les comptes à une date donnée
   */
  static async getAccountBalancesAtDate(date: Date): Promise<Record<string, number>> {
    const allTransactions = await this.getTransactions();
    const accountBalances: Record<string, number> = {};
    
    // Filtrer les transactions jusqu'à la date donnée (inclus)
    const transactionsUpToDate = allTransactions.filter(t => t.date <= date);
    
    // Grouper par compte et trouver le dernier solde de chaque compte
    const accountLastTransactions = new Map<string, Transaction>();
    
    for (const t of transactionsUpToDate) {
      const existing = accountLastTransactions.get(t.accountCode);
      if (!existing || t.date > existing.date || 
          (t.date.getTime() === existing.date.getTime() && t.balance !== undefined)) {
        // Prendre la transaction la plus récente avec un solde défini
        if (t.balance !== undefined && t.balance !== null) {
          accountLastTransactions.set(t.accountCode, t);
        }
      }
    }
    
    // Extraire les soldes
    for (const [accountCode, transaction] of accountLastTransactions) {
      accountBalances[accountCode] = transaction.balance!;
    }
    
    return accountBalances;
  }

  /**
   * Filtre les transactions avec tous les critères et retourne les résultats complets
   */
  static async filterTransactionsAdvanced(params: {
    accountCodes?: string[];
    categoryCodes?: string[];
    startDate?: Date;
    endDate?: Date;
    searchTerm?: string;
  }): Promise<{
    transactions: Transaction[];
    stats: TransactionStats;
    categorySummaries: CategorySummary[];
  }> {
    // Filtrer les transactions
    const filteredTransactions = await this.filterTransactions({
      accountCodes: params.accountCodes,
      categoryCodes: params.categoryCodes,
      startDate: params.startDate,
      endDate: params.endDate,
      searchTerm: params.searchTerm,
    });

    // Calculer les stats avec les transactions filtrées
    const stats = await this.getStats({
      accountCodes: params.accountCodes,
      categoryCodes: params.categoryCodes,
      startDate: params.startDate,
      endDate: params.endDate,
      searchTerm: params.searchTerm,
    });

    // Calculer les résumés par catégorie avec les transactions filtrées
    const categorySummaries = await this.getCategorySummaries({
      accountCodes: params.accountCodes,
      categoryCodes: params.categoryCodes,
      startDate: params.startDate,
      endDate: params.endDate,
      searchTerm: params.searchTerm,
    });

    return {
      transactions: filteredTransactions,
      stats,
      categorySummaries,
    };
  }

  /**
   * Recharge les données
   */
  static async reload(): Promise<void> {
    this.isLoaded = false;
    ConfigService.clearCache();
    await this.loadData();
  }
}

