// Service pour lire et parser les fichiers CSV

import Papa from 'papaparse';
import { Transaction } from '../types/Transaction';
import { FileService } from './FileService';
import { parse, isValid } from 'date-fns';

export class CSVService {
  // Séparateur utilisé dans les CSV
  private static readonly DELIMITER = ';';

  /**
   * Parse une ligne CSV en transaction
   */
  private static parseCSVRow(row: any, accountCode: string, rowIndex: number): Transaction | null {
    try {
      // Les colonnes attendues : Source;Compte;Date;Date de valeur;Débit;Crédit;Libellé;Solde;catégorie;Solde initial;Index
      const date = this.parseDate(row['Date']);
      if (!date || !isValid(date)) {
        return null;
      }

      // IMPORTANT: Les valeurs CSV sont déjà signées (débit négatif, crédit positif)
      const debit = parseFloat(row['Débit'] || '0'); // Déjà négatif dans le CSV
      const credit = parseFloat(row['Crédit'] || '0'); // Déjà positif dans le CSV
      const amount = credit + debit; // Addition car debit est déjà négatif
      const balance = parseFloat(row['Solde'] || '0');

      // Générer un ID unique en combinant accountCode, Index (si présent) et rowIndex
      // Cela garantit l'unicité même si l'Index du CSV est dupliqué
      const csvIndex = row['Index'] || '';
      const uniqueId = csvIndex 
        ? `${accountCode}_${csvIndex}_${rowIndex}` 
        : `${accountCode}_${date.getTime()}_${rowIndex}`;

      const transaction: Transaction = {
        id: uniqueId,
        date,
        description: row['Libellé'] || '',
        amount,
        balance,
        category: row['catégorie'] ? row['catégorie'] : undefined,
        accountCode,
        accountName: row['Compte'] || '',
        originalLine: JSON.stringify(row),
      };

      return transaction;
    } catch (error) {
      console.error('Erreur lors du parsing de la ligne CSV:', error, row);
      return null;
    }
  }

  /**
   * Parse une date au format DD/MM/YYYY
   */
  private static parseDate(dateStr: string): Date | null {
    try {
      const date = parse(dateStr, 'dd/MM/yyyy', new Date());
      return isValid(date) ? date : null;
    } catch {
      return null;
    }
  }

  /**
   * Extrait le code du compte depuis le nom du fichier
   * Format: CCAL_01.01.2025_31.01.2025.csv -> CCAL
   * Normalise le code (trim + uppercase) pour éviter les problèmes de filtrage
   */
  private static extractAccountCode(filename: string): string {
    const match = filename.match(/^([A-Za-z0-9]+)_/);
    const code = match ? match[1] : 'UNKNOWN';
    return code.trim().toUpperCase();
  }

  /**
   * Parse un fichier CSV avec traitement par chunks pour éviter de bloquer le thread principal
   */
  static async parseCSVFile(filePath: string): Promise<Transaction[]> {
    try {
      const content = await FileService.readFile(filePath);
      const filename = filePath.split(/[/\\]/).pop() || '';
      const accountCode = this.extractAccountCode(filename);

      return new Promise((resolve, reject) => {
        Papa.parse(content, {
          header: true,
          delimiter: this.DELIMITER,
          skipEmptyLines: true,
          complete: async (results) => {
            const transactions: Transaction[] = [];
            const CHUNK_SIZE = 100; // Traiter 100 lignes à la fois
            
            // Traiter les données par chunks pour éviter de bloquer le thread principal
            for (let i = 0; i < results.data.length; i += CHUNK_SIZE) {
              const chunk = results.data.slice(i, i + CHUNK_SIZE);
              
              // Traiter le chunk
              for (let j = 0; j < chunk.length; j++) {
                const row = chunk[j];
                const transaction = this.parseCSVRow(row, accountCode, i + j);
                if (transaction) {
                  transactions.push(transaction);
                }
              }
              
              // Permettre au thread principal de traiter d'autres événements
              if (i + CHUNK_SIZE < results.data.length) {
                await new Promise(resolve => setTimeout(resolve, 0));
              }
            }

            // Trier par date (plus récent en premier)
            transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
            
            resolve(transactions);
          },
          error: (error: Error) => {
            reject(new Error(`Erreur lors du parsing du CSV: ${error.message}`));
          },
        });
      });
    } catch (error: any) {
      throw new Error(`Erreur lors de la lecture du fichier CSV: ${error.message}`);
    }
  }

  /**
   * Charge tous les fichiers CSV du dossier data avec traitement par chunks
   */
  static async loadAllTransactions(dataDirectory: string = 'data'): Promise<Transaction[]> {
    try {
      const files = await FileService.readDirectory(dataDirectory);
      const csvFiles = files.filter(file => file.endsWith('.csv'));

      // Si aucun fichier CSV n'est trouvé, retourner un tableau vide
      if (csvFiles.length === 0) {
        console.warn(`[CSVService] Aucun fichier CSV trouvé dans le dossier ${dataDirectory}`);
        return [];
      }

      const allTransactions: Transaction[] = [];

      // Traiter les fichiers par chunks pour éviter de bloquer le thread principal
      const CHUNK_SIZE = 3; // Traiter 3 fichiers à la fois
      for (let i = 0; i < csvFiles.length; i += CHUNK_SIZE) {
        const chunk = csvFiles.slice(i, i + CHUNK_SIZE);
        
        // Traiter les fichiers du chunk en parallèle
        const chunkPromises = chunk.map(async (file) => {
          try {
            const filePath = `${dataDirectory}/${file}`;
            return await this.parseCSVFile(filePath);
          } catch (error: any) {
            console.error(`Erreur lors du chargement de ${file}:`, error.message);
            return [];
          }
        });
        
        const chunkResults = await Promise.all(chunkPromises);
        chunkResults.forEach(transactions => {
          allTransactions.push(...transactions);
        });
        
        // Permettre au thread principal de traiter d'autres événements
        if (i + CHUNK_SIZE < csvFiles.length) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      // Trier toutes les transactions par date (plus récent en premier)
      allTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());

      return allTransactions;
    } catch (error: any) {
      // Si le dossier n'existe pas ou est vide, retourner un tableau vide au lieu de lancer une erreur
      const errorMessage = error.message || String(error);
      if (errorMessage.includes('non trouvé') || errorMessage.includes('n\'existe pas') || errorMessage.includes('does not exist')) {
        console.warn(`[CSVService] Le dossier ${dataDirectory} n'existe pas ou est vide. Retour d'un tableau vide.`);
        return [];
      }
      // Pour les autres erreurs, logger un avertissement mais retourner un tableau vide
      console.warn(`[CSVService] Erreur lors du chargement des transactions: ${errorMessage}. Retour d'un tableau vide.`);
      return [];
    }
  }

  /**
   * Exporte des transactions en CSV
   */
  static async exportToCSV(transactions: Transaction[], filePath: string): Promise<void> {
    const csv = Papa.unparse(transactions.map(t => ({
      'Source': `${t.accountCode}_export.csv`,
      'Compte': t.accountName,
      'Date': t.date.toLocaleDateString('fr-FR'),
      'Date de valeur': t.date.toLocaleDateString('fr-FR'),
      'Débit': t.amount < 0 ? t.amount.toString() : '0', // Garder la valeur négative
      'Crédit': t.amount > 0 ? t.amount.toString() : '0',
      'Libellé': t.description,
      'Solde': t.balance?.toString() || '',
      'catégorie': t.category || 'X',
      'Solde initial': '',
      'Index': t.id,
    })), {
      delimiter: this.DELIMITER,
    });

    await FileService.writeFile(filePath, csv);
  }
}

