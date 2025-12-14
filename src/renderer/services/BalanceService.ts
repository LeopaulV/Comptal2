// Service pour gérer les soldes initiaux des comptes

import { FileService } from './FileService';
import { parse, format, isValid } from 'date-fns';
import Papa from 'papaparse';

interface BalanceEntry {
  date: string; // Format DD/MM/YYYY
  solde: string; // Stocké comme string pour compatibilité avec Comptal1
}

interface BalanceData {
  [accountCode: string]: BalanceEntry[];
}

export class BalanceService {
  private static balanceCache: BalanceData | null = null;

  /**
   * Charge les soldes depuis le fichier solde_compte.json
   */
  static async loadBalances(): Promise<BalanceData> {
    if (this.balanceCache) {
      return this.balanceCache;
    }

    try {
      const content = await FileService.readFile('parametre/solde_compte.json');
      this.balanceCache = JSON.parse(content);
      return this.balanceCache!;
    } catch (error: any) {
      // Si le fichier n'existe pas, créer un fichier vide
      this.balanceCache = {};
      await this.saveBalances(this.balanceCache);
      return this.balanceCache;
    }
  }

  /**
   * Sauvegarde les soldes dans le fichier solde_compte.json
   */
  static async saveBalances(balances: BalanceData): Promise<void> {
    try {
      const content = JSON.stringify(balances, null, 2);
      await FileService.writeFile('parametre/solde_compte.json', content);
      this.balanceCache = balances;
    } catch (error: any) {
      throw new Error(`Erreur lors de la sauvegarde des soldes: ${error.message}`);
    }
  }

  /**
   * Récupère le solde initial pour un compte à une date donnée
   * Retourne null si aucun solde n'est trouvé
   */
  static async getInitialBalance(
    accountCode: string,
    date: string // Format YYYY-MM-DD
  ): Promise<number | null> {
    const balances = await this.loadBalances();

    if (!balances[accountCode] || balances[accountCode].length === 0) {
      return null;
    }

    // Convertir la date au format DD/MM/YYYY pour comparaison
    const targetDate = parse(date, 'yyyy-MM-dd', new Date());
    if (!isValid(targetDate)) {
      return null;
    }

    // Trouver le solde le plus récent avant ou égal à la date cible
    const accountEntries = balances[accountCode]
      .map(entry => ({
        date: parse(entry.date, 'dd/MM/yyyy', new Date()),
        solde: parseFloat(entry.solde),
      }))
      .filter(entry => isValid(entry.date))
      .sort((a, b) => b.date.getTime() - a.date.getTime()); // Tri décroissant

    for (const entry of accountEntries) {
      if (entry.date <= targetDate) {
        return entry.solde;
      }
    }

    return null;
  }

  /**
   * Récupère le dernier solde connu AVANT une date donnée (strictement antérieur)
   * Retourne null si aucun solde n'est trouvé
   */
  static async getBalanceBeforeDate(
    accountCode: string,
    date: string // Format YYYY-MM-DD
  ): Promise<number | null> {
    const balances = await this.loadBalances();

    if (!balances[accountCode] || balances[accountCode].length === 0) {
      return null;
    }

    // Convertir la date au format DD/MM/YYYY pour comparaison
    const targetDate = parse(date, 'yyyy-MM-dd', new Date());
    if (!isValid(targetDate)) {
      return null;
    }

    // Trouver le solde le plus récent strictement avant la date cible
    const accountEntries = balances[accountCode]
      .map(entry => ({
        date: parse(entry.date, 'dd/MM/yyyy', new Date()),
        solde: parseFloat(entry.solde),
      }))
      .filter(entry => isValid(entry.date))
      .sort((a, b) => b.date.getTime() - a.date.getTime()); // Tri décroissant

    for (const entry of accountEntries) {
      if (entry.date < targetDate) {
        console.log(`[Import] Solde récupéré pour ${accountCode} avant ${date}: ${entry.solde} € (date: ${format(entry.date, 'dd/MM/yyyy')})`);
        return entry.solde;
      }
    }

    console.log(`[Import] Aucun solde trouvé pour ${accountCode} avant ${date}`);
    return null;
  }

  /**
   * Ajoute ou met à jour un solde initial pour un compte
   */
  static async setInitialBalance(
    accountCode: string,
    date: string, // Format YYYY-MM-DD
    balance: number
  ): Promise<void> {
    const balances = await this.loadBalances();

    if (!balances[accountCode]) {
      balances[accountCode] = [];
    }

    // Convertir la date au format DD/MM/YYYY
    const formattedDate = format(parse(date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy');

    // Vérifier si une entrée existe déjà pour cette date
    const existingIndex = balances[accountCode].findIndex(
      entry => entry.date === formattedDate
    );

    if (existingIndex >= 0) {
      // Mettre à jour l'entrée existante
      balances[accountCode][existingIndex].solde = balance.toString();
    } else {
      // Ajouter une nouvelle entrée
      balances[accountCode].push({
        date: formattedDate,
        solde: balance.toString(),
      });

      // Trier par date (croissant)
      balances[accountCode].sort((a, b) => {
        const dateA = parse(a.date, 'dd/MM/yyyy', new Date());
        const dateB = parse(b.date, 'dd/MM/yyyy', new Date());
        return dateA.getTime() - dateB.getTime();
      });
    }

    await this.saveBalances(balances);
  }

  /**
   * Récupère le solde initial depuis les fichiers CSV existants
   * Cherche le dernier solde connu AVANT la date de début du fichier à importer
   */
  static async getInitialBalanceFromCSV(
    accountCode: string,
    startDate: string // Format YYYY-MM-DD
  ): Promise<number | null> {
    try {
      console.log(`[Import] Recherche solde initial dans CSV pour ${accountCode} avant ${startDate}`);
      
      // Lister tous les fichiers CSV dans le dossier data
      const files = await FileService.readDirectory('data');
      const csvFiles = files.filter(file => file.endsWith('.csv'));
      
      console.log(`[Import] ${csvFiles.length} fichiers CSV trouvés`);
      
      // Filtrer les fichiers qui correspondent au compte
      const accountFiles = csvFiles.filter(file => {
        // Format attendu: CCAL_01.01.2025_31.01.2025.csv
        const prefix = `${accountCode}_`;
        return file.startsWith(prefix);
      });
      
      console.log(`[Import] ${accountFiles.length} fichiers pour le compte ${accountCode}`);
      
      if (accountFiles.length === 0) {
        console.log(`[Import] Aucun fichier CSV trouvé pour le compte ${accountCode}`);
        return null;
      }

      // Convertir la date de début en Date
      const targetDate = parse(startDate, 'yyyy-MM-dd', new Date());
      if (!isValid(targetDate)) {
        console.error(`[Import] Date invalide: ${startDate}`);
        return null;
      }

      // Extraire les dates de chaque fichier et trouver le plus récent avant la date cible
      const fileDates: Array<{ fileName: string; endDate: Date }> = [];
      
      for (const fileName of accountFiles) {
        // Format: CCAL_01.01.2025_31.01.2025.csv
        const parts = fileName.replace('.csv', '').split('_');
        if (parts.length >= 3) {
          const endDateStr = parts[parts.length - 1]; // Dernière partie = date de fin
          const endDate = parse(endDateStr, 'dd.MM.yyyy', new Date());
          
          if (isValid(endDate) && endDate < targetDate) {
            fileDates.push({ fileName, endDate });
          }
        }
      }

      if (fileDates.length === 0) {
        console.log(`[Import] Aucun fichier CSV trouvé avec une date de fin avant ${startDate}`);
        return null;
      }

      // Trier par date de fin décroissante pour prendre le plus récent
      fileDates.sort((a, b) => b.endDate.getTime() - a.endDate.getTime());
      const mostRecentFile = fileDates[0];
      
      console.log(`[Import] Fichier CSV le plus récent trouvé: ${mostRecentFile.fileName} (fin: ${format(mostRecentFile.endDate, 'dd/MM/yyyy')})`);

      // Lire le fichier CSV et extraire le dernier solde
      try {
        const content = await FileService.readFile(`data/${mostRecentFile.fileName}`);
        
        return new Promise((resolve) => {
          Papa.parse(content, {
            header: true,
            delimiter: ';',
            skipEmptyLines: true,
            complete: (results) => {
              if (!results.data || results.data.length === 0) {
                console.log(`[Import] Fichier ${mostRecentFile.fileName} est vide`);
                resolve(null);
                return;
              }

              // Prendre la dernière ligne (les transactions sont triées par date)
              const lastRow = results.data[results.data.length - 1] as any;
              const solde = lastRow.Solde;
              
              if (solde !== undefined && solde !== null && solde !== '') {
                const soldeNum = parseFloat(String(solde).replace(',', '.'));
                if (!isNaN(soldeNum)) {
                  console.log(`[Import] Solde initial trouvé dans ${mostRecentFile.fileName}: ${soldeNum} €`);
                  resolve(soldeNum);
                } else {
                  console.warn(`[Import] Solde invalide dans ${mostRecentFile.fileName}: ${solde}`);
                  resolve(null);
                }
              } else {
                console.log(`[Import] Aucun solde trouvé dans la dernière ligne de ${mostRecentFile.fileName}`);
                resolve(null);
              }
            },
            error: (error: Error) => {
              console.error(`[Import] Erreur lors du parsing de ${mostRecentFile.fileName}:`, error);
              resolve(null);
            },
          });
        });
      } catch (error: any) {
        console.error(`[Import] Erreur lors de la lecture de ${mostRecentFile.fileName}:`, error.message);
        return null;
      }
    } catch (error: any) {
      console.error(`[Import] Erreur lors de la recherche du solde dans CSV:`, error.message);
      return null;
    }
  }

  /**
   * Réinitialise le cache
   */
  static clearCache(): void {
    this.balanceCache = null;
  }
}

