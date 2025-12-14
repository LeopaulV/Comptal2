// Service principal pour la gestion et l'analyse des données

import { Transaction, TransactionFilter, TransactionStats, MonthlyStats } from '../types/Transaction';
import { AccountSummary } from '../types/Account';
import { CategorySummary } from '../types/Category';
import { CSVService } from './CSVService';
import { ConfigService } from './ConfigService';
import { startOfMonth, format, parse } from 'date-fns';

export class DataService {
  private static transactions: Transaction[] = [];
  private static isLoaded = false;

  /**
   * Charge toutes les transactions
   */
  static async loadData(): Promise<void> {
    if (this.isLoaded) return;

    try {
      this.transactions = await CSVService.loadAllTransactions('data');
      // Accepter un tableau vide comme résultat valide (pas d'erreur)
      if (this.transactions.length === 0) {
        console.warn('[DataService] Aucune transaction chargée. Le dossier data/ est vide ou n\'existe pas.');
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

    // Calculer le total pour les pourcentages
    const totalAmount = validTransactions
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

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
      summary.totalAmount += Math.abs(t.amount);
      summary.transactionCount++;
    }

    // Calculer les pourcentages
    for (const summary of categoryMap.values()) {
      summary.percentage = totalAmount > 0 
        ? (summary.totalAmount / totalAmount) * 100
        : 0;
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

