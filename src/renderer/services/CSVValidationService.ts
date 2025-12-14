// Service pour valider et corriger les incohérences Source/Compte dans les fichiers CSV

import { FileService } from './FileService';
import { ConfigService } from './ConfigService';
import Papa from 'papaparse';

export interface Inconsistency {
  fileName: string;
  lineIndex: number;
  source: string;
  compteFound: string;
  compteExpected: string;
  prefix: string;
}

export interface ValidationResult {
  isValid: boolean;
  inconsistencies: Inconsistency[];
  totalLines: number;
  inconsistentLines: number;
}

export class CSVValidationService {
  private static readonly DELIMITER = ';';

  /**
   * Extrait le préfixe du compte depuis le nom de fichier
   * Format: CCAL_01.01.2025_31.01.2025.csv -> CCAL
   */
  private static extractAccountPrefix(source: string): string {
    const match = source.match(/^([A-Za-z0-9]+)_/);
    return match ? match[1].trim().toUpperCase() : 'UNKNOWN';
  }

  /**
   * Valide la cohérence Source/Compte d'un fichier CSV
   */
  static async validateFile(fileName: string): Promise<ValidationResult> {
    try {
      const filePath = `data/${fileName}`;
      const content = await FileService.readFile(filePath);
      const bankAccounts = await ConfigService.loadAccounts();

      const inconsistencies: Inconsistency[] = [];
      let totalLines = 0;

      await new Promise<void>((resolve) => {
        Papa.parse(content, {
          header: true,
          delimiter: this.DELIMITER,
          skipEmptyLines: true,
          encoding: 'UTF-8',
          complete: (results) => {
            for (let i = 0; i < results.data.length; i++) {
              const row: any = results.data[i];
              totalLines++;

              const source = row['Source'] || fileName;
              const compteFound = row['Compte'] || '';
              const prefix = this.extractAccountPrefix(source);

              // Vérifier que le préfixe existe dans les comptes valides
              if (!(prefix in bankAccounts)) {
                inconsistencies.push({
                  fileName,
                  lineIndex: i,
                  source,
                  compteFound,
                  compteExpected: `PRÉFIXE INVALIDE: ${prefix}`,
                  prefix,
                });
                continue;
              }

              // Obtenir le nom de compte attendu
              const accountData = bankAccounts[prefix];
              const compteExpected = typeof accountData === 'object' && accountData !== null && 'name' in accountData
                ? accountData.name
                : String(accountData || prefix);

              // Vérifier la cohérence
              if (compteFound !== compteExpected) {
                inconsistencies.push({
                  fileName,
                  lineIndex: i,
                  source,
                  compteFound,
                  compteExpected,
                  prefix,
                });
              }
            }
            resolve();
          },
          error: (error: Error) => {
            console.error(`[CSVValidationService] Erreur lors du parsing de ${fileName}:`, error);
            resolve();
          },
        });
      });

      return {
        isValid: inconsistencies.length === 0,
        inconsistencies,
        totalLines,
        inconsistentLines: inconsistencies.length,
      };
    } catch (error: any) {
      console.error(`[CSVValidationService] Erreur lors de la validation de ${fileName}:`, error);
      throw new Error(`Erreur lors de la validation: ${error.message}`);
    }
  }

  /**
   * Détecte toutes les incohérences dans tous les fichiers CSV
   */
  static async detectAllInconsistencies(): Promise<Inconsistency[]> {
    try {
      const files = await FileService.readDirectory('data');
      const csvFiles = files.filter(file => file.endsWith('.csv'));

      const allInconsistencies: Inconsistency[] = [];

      for (const fileName of csvFiles) {
        try {
          const result = await this.validateFile(fileName);
          allInconsistencies.push(...result.inconsistencies);
        } catch (error: any) {
          console.error(`[CSVValidationService] Erreur lors de la validation de ${fileName}:`, error.message);
        }
      }

      return allInconsistencies;
    } catch (error: any) {
      console.error('[CSVValidationService] Erreur lors de la détection des incohérences:', error);
      throw new Error(`Erreur lors de la détection: ${error.message}`);
    }
  }

  /**
   * Corrige automatiquement le Compte depuis le Source dans un fichier CSV
   */
  static async correctCompteFromSource(fileName: string): Promise<{ corrected: number; errors: number }> {
    try {
      const filePath = `data/${fileName}`;
      const content = await FileService.readFile(filePath);
      const bankAccounts = await ConfigService.loadAccounts();

      const rows: any[] = [];
      let corrected = 0;
      let errors = 0;

      await new Promise<void>((resolve) => {
        Papa.parse(content, {
          header: true,
          delimiter: this.DELIMITER,
          skipEmptyLines: true,
          encoding: 'UTF-8',
          complete: (results) => {
            for (let i = 0; i < results.data.length; i++) {
              const row: any = results.data[i];
              const source = row['Source'] || fileName;
              const prefix = this.extractAccountPrefix(source);

              if (prefix in bankAccounts) {
                const accountData = bankAccounts[prefix];
                const compteExpected = typeof accountData === 'object' && accountData !== null && 'name' in accountData
                  ? accountData.name
                  : String(accountData || prefix);

                if (row['Compte'] !== compteExpected) {
                  row['Compte'] = compteExpected;
                  corrected++;
                  console.log(
                    `[CSVValidationService] Ligne ${i} corrigée: ` +
                    `Compte="${row['Compte']}" -> "${compteExpected}"`
                  );
                }
              } else {
                errors++;
                console.warn(
                  `[CSVValidationService] Préfixe invalide "${prefix}" dans ${fileName}, ligne ${i}`
                );
              }

              rows.push(row);
            }
            resolve();
          },
          error: (error: Error) => {
            console.error(`[CSVValidationService] Erreur lors du parsing de ${fileName}:`, error);
            resolve();
          },
        });
      });

      // Sauvegarder le fichier corrigé
      if (corrected > 0) {
        const csv = Papa.unparse(rows, {
          delimiter: this.DELIMITER,
          header: true,
        });
        await FileService.writeFile(filePath, csv);
        console.log(`[CSVValidationService] Fichier ${fileName} corrigé: ${corrected} ligne(s) modifiée(s)`);
      }

      return { corrected, errors };
    } catch (error: any) {
      console.error(`[CSVValidationService] Erreur lors de la correction de ${fileName}:`, error);
      throw new Error(`Erreur lors de la correction: ${error.message}`);
    }
  }

  /**
   * Sépare un fichier en plusieurs fichiers si des comptes différents sont détectés
   */
  static async splitFileByCompte(fileName: string): Promise<{ createdFiles: string[]; errors: number }> {
    try {
      const filePath = `data/${fileName}`;
      const content = await FileService.readFile(filePath);
      const bankAccounts = await ConfigService.loadAccounts();

      const compteGroups: Record<string, any[]> = {};
      let errors = 0;

      await new Promise<void>((resolve) => {
        Papa.parse(content, {
          header: true,
          delimiter: this.DELIMITER,
          skipEmptyLines: true,
          encoding: 'UTF-8',
          complete: (results) => {
            for (let i = 0; i < results.data.length; i++) {
              const row: any = results.data[i];
              const compte = row['Compte'] || '';

              if (!compteGroups[compte]) {
                compteGroups[compte] = [];
              }
              compteGroups[compte].push(row);
            }
            resolve();
          },
          error: (error: Error) => {
            console.error(`[CSVValidationService] Erreur lors du parsing de ${fileName}:`, error);
            resolve();
          },
        });
      });

      const createdFiles: string[] = [];

      // Si un seul compte, pas besoin de séparer
      if (Object.keys(compteGroups).length <= 1) {
        console.log(`[CSVValidationService] Fichier ${fileName} ne contient qu'un seul compte, pas de séparation nécessaire`);
        return { createdFiles: [], errors: 0 };
      }

      // Trouver le préfixe pour chaque compte et créer un fichier séparé
      for (const [compte, rows] of Object.entries(compteGroups)) {
        // Trouver le préfixe correspondant au compte
        const comptePrefix = Object.entries(bankAccounts).find(
          ([_, data]) => {
            const name = typeof data === 'object' && data !== null && 'name' in data
              ? data.name
              : String(data);
            return name === compte;
          }
        )?.[0];

        if (!comptePrefix) {
          console.warn(
            `[CSVValidationService] Préfixe non trouvé pour le compte "${compte}" dans ${fileName}`
          );
          errors++;
          continue;
        }

        // Extraire la partie date du nom de fichier original
        const datePart = fileName.split('_').slice(1).join('_');
        const newFileName = `${comptePrefix}_${datePart}`;

        // Trier par date
        rows.sort((a, b) => {
          const dateA = this.parseDate(a['Date']);
          const dateB = this.parseDate(b['Date']);
          if (!dateA || !dateB) return 0;
          return dateA.getTime() - dateB.getTime();
        });

        // Générer le CSV
        const csv = Papa.unparse(rows, {
          delimiter: this.DELIMITER,
          header: true,
        });

        // Sauvegarder le fichier
        const newFilePath = `data/${newFileName}`;
        await FileService.writeFile(newFilePath, csv);
        createdFiles.push(newFileName);

        console.log(
          `[CSVValidationService] Fichier créé: ${newFileName} ` +
          `(${rows.length} ligne(s) pour le compte "${compte}")`
        );
      }

      // Supprimer le fichier original si des fichiers ont été créés
      if (createdFiles.length > 0) {
        console.log(`[CSVValidationService] Fichier original ${fileName} peut être supprimé (${createdFiles.length} fichier(s) créé(s))`);
        // Note: On ne supprime pas automatiquement, l'utilisateur peut le faire manuellement
      }

      return { createdFiles, errors };
    } catch (error: any) {
      console.error(`[CSVValidationService] Erreur lors de la séparation de ${fileName}:`, error);
      throw new Error(`Erreur lors de la séparation: ${error.message}`);
    }
  }

  /**
   * Parse une date au format dd/MM/yyyy
   */
  private static parseDate(dateStr: string): Date | null {
    try {
      const [day, month, year] = dateStr.split('/');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } catch {
      return null;
    }
  }
}

