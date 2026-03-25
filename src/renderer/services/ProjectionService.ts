// Service pour calculer les projections financières

import { Subscription, ProjectionConfig, ProjectionData, ProjectionDataByAccount, Periodicity } from '../types/ProjectManagement';
import { ChartGranularity, getPeriodKey } from './DataService';
import { addDays, addWeeks, addMonths, addQuarters, addYears, isAfter, isBefore, isSameDay, startOfDay, eachDayOfInterval, format, differenceInDays, differenceInWeeks, differenceInMonths } from 'date-fns';

export class ProjectionService {
  /**
   * Récupère récursivement tous les abonnements "feuilles" (ignorer les groupes conteneurs)
   */
  static getAllFlatSubscriptions(subscriptions: Subscription[]): Subscription[] {
    let flatList: Subscription[] = [];
    
    for (const sub of subscriptions) {
      if (sub.isGroup && sub.children && sub.children.length > 0) {
        flatList = [...flatList, ...this.getAllFlatSubscriptions(sub.children)];
      } else if (!sub.isGroup) {
        flatList.push(sub);
      }
    }
    
    return flatList;
  }

  /**
   * Récupère récursivement toutes les lignes (abonnements feuilles) d'un groupe
   * @param group - Le groupe de subscriptions
   * @returns Liste de toutes les subscriptions feuilles du groupe
   */
  static getAllGroupLines(group: Subscription): Subscription[] {
    if (!group.isGroup || !group.children || group.children.length === 0) {
      return [];
    }

    let lines: Subscription[] = [];
    
    for (const child of group.children) {
      if (child.isGroup && child.children && child.children.length > 0) {
        // Si c'est un sous-groupe, récursion
        lines = [...lines, ...this.getAllGroupLines(child)];
      } else if (!child.isGroup) {
        // Si c'est une ligne feuille, l'ajouter
        lines.push(child);
      }
    }
    
    return lines;
  }

  /**
   * Calcule la projection financière sur une période donnée
   */
  static calculateProjection(
    subscriptions: Subscription[],
    config: ProjectionConfig
  ): ProjectionData[] {
    const results: ProjectionData[] = [];
    const startDate = startOfDay(config.startDate);
    const endDate = startOfDay(config.endDate);
    
    // Aplatir la liste des abonnements pour le calcul (ignorer les groupes)
    const flatSubscriptions = this.getAllFlatSubscriptions(subscriptions);
    
    // Générer toutes les dates de la période (par jour)
    const dates = eachDayOfInterval({ start: startDate, end: endDate });
    
    let currentBalance = config.initialBalance;
    let cumulativeImpact = 0;
    
    for (const date of dates) {
      let totalDebits = 0;
      let totalCredits = 0;
      
      // Calculer les débits et crédits pour cette date
      // Les débits sont toujours négatifs, les crédits toujours positifs
      for (const subscription of flatSubscriptions) {
        // applySubscriptionToDate retourne déjà le montant capitalisé si un taux est défini
        const amount = this.applySubscriptionToDate(subscription, date);
        
        if (amount !== 0) {
          if (subscription.type === 'debit') {
            totalDebits -= Math.abs(amount); // Débits toujours négatifs
          } else {
            totalCredits += amount;
          }
        }
        
        // Appliquer l'indicateur de crédit si défini (toujours en crédit)
        if (subscription.advancedSettings?.creditIndicator) {
          const creditAmount = this.applyCreditIndicatorToDate(subscription, date);
          if (creditAmount !== 0) {
            totalCredits += creditAmount;
          }
        }
      }
      
      const netFlow = totalCredits + totalDebits; // totalDebits <= 0
      currentBalance += netFlow;
      cumulativeImpact += netFlow;
      
      results.push({
        date: new Date(date),
        balance: currentBalance,
        totalDebits,
        totalCredits,
        netFlow,
        cumulativeImpact,
      });
    }
    
    return results;
  }
  
  /**
   * Génère les dates d'application d'un abonnement selon sa périodicité
   */
  static generateDates(startDate: Date, endDate: Date, periodicity: Periodicity): Date[] {
    const dates: Date[] = [];
    let currentDate = startOfDay(startDate);
    const end = startOfDay(endDate);
    
    // Pour 'unique', retourner uniquement la date de début si elle est dans la plage
    if (periodicity === 'unique') {
      if (!isAfter(currentDate, end)) {
        dates.push(new Date(currentDate));
      }
      return dates;
    }
    
    while (!isAfter(currentDate, end)) {
      dates.push(new Date(currentDate));
      
      switch (periodicity) {
        case 'daily':
          currentDate = addDays(currentDate, 1);
          break;
        case 'weekly':
          currentDate = addWeeks(currentDate, 1);
          break;
        case 'monthly':
          currentDate = addMonths(currentDate, 1);
          break;
        case 'quarterly':
          currentDate = addQuarters(currentDate, 1);
          break;
        case 'yearly':
          currentDate = addYears(currentDate, 1);
          break;
      }
    }
    
    return dates;
  }
  
  /**
   * Retourne le multiplicateur pour convertir une périodicité en montant mensuel
   */
  static getPeriodicityMultiplier(periodicity: Periodicity): number {
    switch (periodicity) {
      case 'daily':
        return 30; // Approximation : 30 jours par mois
      case 'weekly':
        return 4.33; // Approximation : 52 semaines / 12 mois
      case 'monthly':
        return 1;
      case 'quarterly':
        return 1 / 3; // 1 trimestre = 1/3 de mois
      case 'yearly':
        return 1 / 12; // 1 année = 1/12 de mois
      case 'unique':
        return 0; // Unique ne se répète pas, donc 0 par mois
      default:
        return 1;
    }
  }
  
  /**
   * Calcule le montant capitalisé selon le nombre de périodes de fréquence écoulées
   * Formule : montantInitial × (1 + taux/100)^nombrePeriodes
   */
  static getCapitalizedAmount(subscription: Subscription, date: Date): number {
    if (!subscription.advancedSettings?.rate) {
      return subscription.amount;
    }
    
    const rate = subscription.advancedSettings.rate;
    const checkDate = startOfDay(date);
    const start = startOfDay(subscription.startDate);
    
    // Vérifier si la date est avant le début de l'abonnement
    if (isBefore(checkDate, start)) {
      return subscription.amount;
    }
    
    // Calculer le nombre de périodes complètes écoulées selon la fréquence
    let numberOfPeriods = 0;
    
    switch (rate.frequency) {
      case 'daily':
        numberOfPeriods = Math.floor(differenceInDays(checkDate, start));
        break;
      case 'weekly':
        numberOfPeriods = Math.floor(differenceInWeeks(checkDate, start));
        break;
      case 'monthly':
        numberOfPeriods = Math.floor(differenceInMonths(checkDate, start));
        break;
      case 'quarterly':
        // Un trimestre = 3 mois
        numberOfPeriods = Math.floor(differenceInMonths(checkDate, start) / 3);
        break;
      case 'yearly':
        // Pour une fréquence annuelle, calculer en mois puis diviser par 12
        // Cela permet d'appliquer la capitalisation au 13ème mois (après 12 mois)
        numberOfPeriods = Math.floor(differenceInMonths(checkDate, start) / 12);
        break;
      case 'unique':
        // Pour unique, pas de capitalisation (s'applique une seule fois)
        numberOfPeriods = 0;
        break;
      default:
        numberOfPeriods = 0;
    }
    
    // Si aucune période complète ne s'est écoulée, retourner le montant initial
    if (numberOfPeriods <= 0) {
      return subscription.amount;
    }
    
    // Appliquer la capitalisation composée : montant × (1 + taux/100)^nombrePeriodes
    const rateMultiplier = 1 + (rate.percentage / 100);
    const capitalizedAmount = subscription.amount * Math.pow(rateMultiplier, numberOfPeriods);
    
    return capitalizedAmount;
  }
  
  /**
   * Applique un abonnement à une date donnée (retourne le montant si applicable, 0 sinon)
   * Si un taux est défini, retourne le montant capitalisé selon la fréquence du taux
   */
  static applySubscriptionToDate(subscription: Subscription, date: Date): number {
    const checkDate = startOfDay(date);
    const start = startOfDay(subscription.startDate);
    
    // Vérifier si la date est avant le début de l'abonnement
    if (isBefore(checkDate, start)) {
      return 0;
    }
    
    // Vérifier si l'abonnement a une date de fin et si on est après
    if (subscription.endDate) {
      const end = startOfDay(subscription.endDate);
      if (isAfter(checkDate, end)) {
        return 0;
      }
    }
    
    // Générer les dates d'application de l'abonnement
    const endDate = subscription.endDate || date;
    const applicationDates = this.generateDates(subscription.startDate, endDate, subscription.periodicity);
    
    // Vérifier si la date correspond à une date d'application
    const isApplicationDate = applicationDates.some(appDate => 
      isSameDay(startOfDay(appDate), checkDate)
    );
    
    if (!isApplicationDate) {
      return 0;
    }
    
    // Si un taux est défini, utiliser le montant capitalisé
    if (subscription.advancedSettings?.rate) {
      return this.getCapitalizedAmount(subscription, date);
    }
    
    return subscription.amount;
  }
  
  /**
   * Applique le taux à une date donnée (retourne le montant du taux si applicable, 0 sinon)
   */
  static applyRateToDate(subscription: Subscription, date: Date): number {
    if (!subscription.advancedSettings?.rate) {
      return 0;
    }
    
    const rate = subscription.advancedSettings.rate;
    const checkDate = startOfDay(date);
    const start = startOfDay(subscription.startDate);
    
    // Vérifier si la date est avant le début de l'abonnement
    if (isBefore(checkDate, start)) {
      return 0;
    }
    
    // Vérifier si l'abonnement a une date de fin et si on est après
    if (subscription.endDate) {
      const end = startOfDay(subscription.endDate);
      if (isAfter(checkDate, end)) {
        return 0;
      }
    }
    
    // Générer les dates d'application du taux selon sa fréquence
    const endDate = subscription.endDate || date;
    const applicationDates = this.generateDates(subscription.startDate, endDate, rate.frequency);
    
    // Vérifier si la date correspond à une date d'application du taux
    const isApplicationDate = applicationDates.some(appDate => 
      isSameDay(startOfDay(appDate), checkDate)
    );
    
    if (isApplicationDate) {
      // Calculer le montant du taux : pourcentage du montant de base
      return (subscription.amount * rate.percentage) / 100;
    }
    
    return 0;
  }
  
  /**
   * Applique l'indicateur de crédit à une date donnée (retourne le montant si applicable, 0 sinon)
   */
  static applyCreditIndicatorToDate(subscription: Subscription, date: Date): number {
    if (!subscription.advancedSettings?.creditIndicator) {
      return 0;
    }
    
    const creditIndicator = subscription.advancedSettings.creditIndicator;
    const checkDate = startOfDay(date);
    const start = startOfDay(subscription.startDate);
    
    // Vérifier si la date est avant le début de l'abonnement
    if (isBefore(checkDate, start)) {
      return 0;
    }
    
    // Vérifier si l'abonnement a une date de fin et si on est après
    if (subscription.endDate) {
      const end = startOfDay(subscription.endDate);
      if (isAfter(checkDate, end)) {
        return 0;
      }
    }
    
    // Générer les dates d'application de l'indicateur de crédit selon sa fréquence
    const endDate = subscription.endDate || date;
    const applicationDates = this.generateDates(subscription.startDate, endDate, creditIndicator.frequency);
    
    // Vérifier si la date correspond à une date d'application de l'indicateur de crédit
    const isApplicationDate = applicationDates.some(appDate => 
      isSameDay(startOfDay(appDate), checkDate)
    );
    
    return isApplicationDate ? creditIndicator.amount : 0;
  }
  
  /**
   * Calcule la projection financière répartie par compte selon les priorités et plafonds
   */
  static calculateProjectionByAccount(
    subscriptions: Subscription[],
    config: ProjectionConfig
  ): ProjectionDataByAccount[] {
    // Si pas de configuration de comptes, retourner un tableau vide
    if (!config.accountConfigs || config.accountConfigs.length === 0) {
      return [];
    }

    const results: ProjectionDataByAccount[] = [];
    const startDate = startOfDay(config.startDate);
    const endDate = startOfDay(config.endDate);
    
    // Aplatir la liste des abonnements pour le calcul (ignorer les groupes)
    const flatSubscriptions = this.getAllFlatSubscriptions(subscriptions);
    
    // Générer toutes les dates de la période (par jour)
    const dates = eachDayOfInterval({ start: startDate, end: endDate });
    
    // Trier les comptes par priorité (1 = plus prioritaire)
    const sortedAccountConfigs = [...config.accountConfigs].sort((a, b) => a.priority - b.priority);
    
    // Initialiser les soldes par compte
    const accountBalances: Record<string, number> = {};
    for (const accountConfig of sortedAccountConfigs) {
      accountBalances[accountConfig.accountCode] = accountConfig.initialBalance;
    }
    
    for (const date of dates) {
      let totalDebits = 0;
      let totalCredits = 0;
      
      // Calculer les débits et crédits pour cette date
      for (const subscription of flatSubscriptions) {
        const amount = this.applySubscriptionToDate(subscription, date);
        
        if (amount !== 0) {
          if (subscription.type === 'debit') {
            totalDebits -= Math.abs(amount); // Débits toujours négatifs
          } else {
            totalCredits += amount;
          }
        }
        
        // Appliquer l'indicateur de crédit si défini (toujours en crédit)
        if (subscription.advancedSettings?.creditIndicator) {
          const creditAmount = this.applyCreditIndicatorToDate(subscription, date);
          if (creditAmount !== 0) {
            totalCredits += creditAmount;
          }
        }
      }
      
      const netFlow = totalCredits + totalDebits; // totalDebits <= 0
      
      // Distribuer le flux net selon les règles
      if (netFlow > 0) {
        // SURPLUS : Distribuer aux comptes par ordre de priorité jusqu'au plafond
        let remainingSurplus = netFlow;
        
        for (const accountConfig of sortedAccountConfigs) {
          if (remainingSurplus <= 0) break;
          
          const currentBalance = accountBalances[accountConfig.accountCode];
          const ceiling = accountConfig.ceiling === Infinity ? Number.MAX_SAFE_INTEGER : accountConfig.ceiling;
          const availableSpace = Math.max(0, ceiling - currentBalance);
          
          if (availableSpace > 0) {
            const amountToAdd = Math.min(remainingSurplus, availableSpace);
            accountBalances[accountConfig.accountCode] += amountToAdd;
            remainingSurplus -= amountToAdd;
          }
        }
        
        // Si il reste du surplus après avoir rempli tous les comptes, on l'ajoute au dernier compte
        if (remainingSurplus > 0 && sortedAccountConfigs.length > 0) {
          const lastAccount = sortedAccountConfigs[sortedAccountConfigs.length - 1];
          accountBalances[lastAccount.accountCode] += remainingSurplus;
        }
      } else if (netFlow < 0) {
        // DÉFICIT : Prélever des comptes par ordre inverse de priorité (dernier = premier vidé)
        let remainingDeficit = Math.abs(netFlow);
        
        // Trier par priorité décroissante pour prélever du moins prioritaire au plus prioritaire
        const reverseSortedConfigs = [...sortedAccountConfigs].sort((a, b) => b.priority - a.priority);
        
        for (const accountConfig of reverseSortedConfigs) {
          if (remainingDeficit <= 0) break;
          
          const currentBalance = accountBalances[accountConfig.accountCode];
          if (currentBalance > 0) {
            const amountToWithdraw = Math.min(remainingDeficit, currentBalance);
            accountBalances[accountConfig.accountCode] -= amountToWithdraw;
            remainingDeficit -= amountToWithdraw;
          }
        }
        
        // Si il reste du déficit après avoir vidé tous les comptes, les soldes peuvent devenir négatifs
        if (remainingDeficit > 0 && sortedAccountConfigs.length > 0) {
          const lastAccount = sortedAccountConfigs[sortedAccountConfigs.length - 1];
          accountBalances[lastAccount.accountCode] -= remainingDeficit;
        }
      }
      
      // Calculer le solde total
      const totalBalance = Object.values(accountBalances).reduce((sum, balance) => sum + balance, 0);
      
      // Créer une copie des soldes par compte pour cette date
      const accountBalancesCopy: Record<string, number> = {};
      for (const accountConfig of sortedAccountConfigs) {
        accountBalancesCopy[accountConfig.accountCode] = accountBalances[accountConfig.accountCode];
      }
      
      results.push({
        date: new Date(date),
        accountBalances: accountBalancesCopy,
        totalBalance,
        totalDebits,
        totalCredits,
        netFlow,
      });
    }
    
    return results;
  }
  
  /**
   * Calcule les données agrégées par mois pour les graphiques
   */
  static aggregateByMonth(projectionData: ProjectionData[]): {
    months: string[];
    balances: number[];
    debits: number[];
    credits: number[];
    netFlows: number[];
  } {
    const monthlyData: Map<string, {
      balance: number;
      debits: number;
      credits: number;
      netFlow: number;
    }> = new Map();
    
    for (const data of projectionData) {
      const monthKey = format(data.date, 'yyyy-MM');
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          balance: 0,
          debits: 0,
          credits: 0,
          netFlow: 0,
        });
      }
      
      const monthData = monthlyData.get(monthKey)!;
      monthData.balance = data.balance; // Prendre le dernier solde du mois
      monthData.debits += data.totalDebits;
      monthData.credits += data.totalCredits;
      monthData.netFlow += data.netFlow;
    }
    
    const months = Array.from(monthlyData.keys()).sort();
    const balances = months.map(month => monthlyData.get(month)!.balance);
    const debits = months.map(month => monthlyData.get(month)!.debits);
    const credits = months.map(month => monthlyData.get(month)!.credits);
    const netFlows = months.map(month => monthlyData.get(month)!.netFlow);
    
    return {
      months,
      balances,
      debits,
      credits,
      netFlows,
    };
  }

  /**
   * Calcule les données agrégées par période (jour, semaine, mois, trimestre, semestre, année)
   * pour alignement avec la toolbar de granularité Finance Global
   */
  static aggregateByPeriod(
    projectionData: ProjectionData[],
    granularity: ChartGranularity
  ): {
    months: string[];
    balances: number[];
    debits: number[];
    credits: number[];
    netFlows: number[];
  } {
    const periodData: Map<string, {
      balance: number;
      debits: number;
      credits: number;
      netFlow: number;
    }> = new Map();

    for (const data of projectionData) {
      const periodKey = getPeriodKey(data.date, granularity);

      if (!periodData.has(periodKey)) {
        periodData.set(periodKey, {
          balance: 0,
          debits: 0,
          credits: 0,
          netFlow: 0,
        });
      }

      const p = periodData.get(periodKey)!;
      p.balance = data.balance;
      p.debits += data.totalDebits;
      p.credits += data.totalCredits;
      p.netFlow += data.netFlow;
    }

    const months = Array.from(periodData.keys()).sort();
    const balances = months.map((m) => periodData.get(m)!.balance);
    const debits = months.map((m) => periodData.get(m)!.debits);
    const credits = months.map((m) => periodData.get(m)!.credits);
    const netFlows = months.map((m) => periodData.get(m)!.netFlow);

    return {
      months,
      balances,
      debits,
      credits,
      netFlows,
    };
  }

  /**
   * Agrège les charges (débits) par poste/abonnement et par période pour le graphique Bilan Financier.
   * Retourne le détail par poste avec les couleurs attribuées.
   */
  static aggregateChargesBySubscriptionAndPeriod(
    subscriptions: Subscription[],
    config: ProjectionConfig,
    granularity: ChartGranularity,
    dateFrom?: Date | null,
    dateTo?: Date | null
  ): {
    periodKeys: string[];
    categories: string[];
    monthlyData: number[][];
    categoryColors: Record<string, string>;
  } {
    const flat = this.getAllFlatSubscriptions(subscriptions).filter((s) => s.type === 'debit');
    if (flat.length === 0) {
      return { periodKeys: [], categories: [], monthlyData: [], categoryColors: {} };
    }

    const startDate = startOfDay(config.startDate);
    const endDate = startOfDay(config.endDate);
    const filterStart = dateFrom ? startOfDay(dateFrom) : null;
    const filterEnd = dateTo ? startOfDay(dateTo) : null;

    const dates = eachDayOfInterval({ start: startDate, end: endDate });
    const periodMap = new Map<string, Map<string, number>>();
    const categoryColors: Record<string, string> = {};

    for (const date of dates) {
      const t = date.getTime();
      if (filterStart && t < filterStart.getTime()) continue;
      if (filterEnd && t > filterEnd.getTime()) continue;

      const periodKey = getPeriodKey(date, granularity);
      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, new Map());
      }
      const periodData = periodMap.get(periodKey)!;

      for (const sub of flat) {
        const amount = this.applySubscriptionToDate(sub, date);
        if (amount !== 0 && sub.type === 'debit') {
          const debitAmount = Math.abs(amount);
          const label = sub.name;
          const current = periodData.get(label) ?? 0;
          periodData.set(label, current + debitAmount);
          if (!categoryColors[label]) {
            categoryColors[label] = sub.color || '#808080';
          }
        }
      }
    }

    const periodKeys = [...periodMap.keys()].sort();
    const categories = Array.from(
      new Set(flat.map((s) => s.name))
    );
    const monthlyData = categories.map((cat) =>
      periodKeys.map((pk) => periodMap.get(pk)?.get(cat) ?? 0)
    );

    return {
      periodKeys,
      categories,
      monthlyData,
      categoryColors,
    };
  }
}
