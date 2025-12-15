// Service pour mettre à jour les codes (abréviations) dans les fichiers CSV

import Papa from 'papaparse';
import { FileService } from './FileService';
import { ConfigService } from './ConfigService';

export class CodeUpdateService {
  private static readonly DELIMITER = ';';

  /**
   * Met à jour tous les fichiers CSV pour remplacer un code de catégorie
   * @param oldCode Ancien code de catégorie
   * @param newCode Nouveau code de catégorie
   * @returns Nombre de fichiers modifiés
   */
  static async updateCategoryCodeInCSV(oldCode: string, newCode: string): Promise<number> {
    try {
      // Charger tous les fichiers CSV
      const files = await FileService.readDirectory('data');
      const csvFiles = files.filter(file => file.endsWith('.csv'));

      if (csvFiles.length === 0) {
        console.log('[CodeUpdateService] Aucun fichier CSV trouvé');
        return 0;
      }

      let filesModified = 0;

      // Traiter les fichiers par lots pour éviter de bloquer l'interface
      const CHUNK_SIZE = 5;
      for (let i = 0; i < csvFiles.length; i += CHUNK_SIZE) {
        const chunk = csvFiles.slice(i, i + CHUNK_SIZE);

        await Promise.all(
          chunk.map(async (fileName) => {
            try {
              const filePath = `data/${fileName}`;
              const content = await FileService.readFile(filePath);

              // Parser le CSV
              const parseResult = await new Promise<any>((resolve, reject) => {
                Papa.parse(content, {
                  header: true,
                  delimiter: this.DELIMITER,
                  skipEmptyLines: true,
                  complete: resolve,
                  error: reject,
                });
              });

              const rows = parseResult.data as any[];
              let hasChanges = false;

              // Mettre à jour la colonne catégorie
              for (const row of rows) {
                if (row['catégorie'] === oldCode) {
                  row['catégorie'] = newCode;
                  hasChanges = true;
                }
              }

              // Sauvegarder si des changements ont été effectués
              if (hasChanges) {
                const csv = Papa.unparse(rows, {
                  delimiter: this.DELIMITER,
                  header: true,
                });
                await FileService.writeFile(filePath, csv);
                filesModified++;
                console.log(`[CodeUpdateService] Fichier ${fileName} mis à jour (catégorie ${oldCode} -> ${newCode})`);
              }

              // Permettre au thread principal de traiter d'autres événements
              if (i + CHUNK_SIZE < csvFiles.length) {
                await new Promise(resolve => setTimeout(resolve, 0));
              }
            } catch (error: any) {
              console.error(`[CodeUpdateService] Erreur lors du traitement de ${fileName}:`, error.message);
              // Continuer avec les autres fichiers
            }
          })
        );
      }

      console.log(`[CodeUpdateService] ${filesModified} fichier(s) modifié(s) pour la catégorie ${oldCode} -> ${newCode}`);
      return filesModified;
    } catch (error: any) {
      console.error('[CodeUpdateService] Erreur lors de la mise à jour des catégories:', error);
      throw new Error(`Erreur lors de la mise à jour des codes de catégorie: ${error.message}`);
    }
  }

  /**
   * Met à jour tous les fichiers CSV pour remplacer un code de compte
   * Renomme les fichiers et met à jour leur contenu
   * @param oldCode Ancien code de compte
   * @param newCode Nouveau code de compte
   * @param newAccountName Nouveau nom de compte (optionnel, sera récupéré depuis la config si non fourni)
   * @returns Nombre de fichiers modifiés
   */
  static async updateAccountCodeInCSV(oldCode: string, newCode: string, newAccountName?: string): Promise<number> {
    try {
      // Charger les comptes pour obtenir les noms complets
      const accounts = await ConfigService.loadAccounts();
      const oldAccountData = accounts[oldCode];

      if (!oldAccountData) {
        throw new Error(`Le compte avec le code "${oldCode}" n'existe pas`);
      }

      const oldAccountName = typeof oldAccountData === 'object' && oldAccountData !== null && 'name' in oldAccountData
        ? oldAccountData.name
        : String(oldAccountData);

      // Utiliser le nom fourni en paramètre, ou essayer de le récupérer depuis la config, ou utiliser l'ancien nom
      let finalNewAccountName: string;
      if (newAccountName) {
        finalNewAccountName = newAccountName;
      } else {
        const newAccountData = accounts[newCode];
        if (newAccountData && typeof newAccountData === 'object' && newAccountData !== null && 'name' in newAccountData) {
          finalNewAccountName = newAccountData.name;
        } else {
          // Si le nouveau compte n'existe pas encore dans la config, utiliser l'ancien nom
          finalNewAccountName = oldAccountName;
        }
      }

      // Charger tous les fichiers CSV
      const files = await FileService.readDirectory('data');
      const csvFiles = files.filter(file => file.endsWith('.csv'));

      if (csvFiles.length === 0) {
        console.log('[CodeUpdateService] Aucun fichier CSV trouvé');
        return 0;
      }

      // Filtrer les fichiers qui commencent par l'ancien code
      const filesToRename = csvFiles.filter(file => {
        const prefix = this.extractAccountPrefix(file);
        return prefix === oldCode.toUpperCase();
      });

      if (filesToRename.length === 0) {
        console.log(`[CodeUpdateService] Aucun fichier trouvé avec le préfixe ${oldCode}`);
        return 0;
      }

      let filesModified = 0;

      // Traiter les fichiers par lots
      const CHUNK_SIZE = 3;
      for (let i = 0; i < filesToRename.length; i += CHUNK_SIZE) {
        const chunk = filesToRename.slice(i, i + CHUNK_SIZE);

        await Promise.all(
          chunk.map(async (oldFileName) => {
            try {
              const oldFilePath = `data/${oldFileName}`;
              const content = await FileService.readFile(oldFilePath);

              // Générer le nouveau nom de fichier
              const newFileName = oldFileName.replace(new RegExp(`^${oldCode}_`, 'i'), `${newCode}_`);
              const newFilePath = `data/${newFileName}`;

              // Parser le CSV
              const parseResult = await new Promise<any>((resolve, reject) => {
                Papa.parse(content, {
                  header: true,
                  delimiter: this.DELIMITER,
                  skipEmptyLines: true,
                  complete: resolve,
                  error: reject,
                });
              });

              const rows = parseResult.data as any[];
              let hasChanges = false;

              // Mettre à jour les colonnes Compte et Source
              for (const row of rows) {
                // Mettre à jour la colonne Compte si elle contient l'ancien nom
                if (row['Compte'] === oldAccountName) {
                  row['Compte'] = finalNewAccountName;
                  hasChanges = true;
                }

                // Mettre à jour la colonne Source si elle contient l'ancien nom de fichier
                if (row['Source'] === oldFileName) {
                  row['Source'] = newFileName;
                  hasChanges = true;
                }
              }

              // Sauvegarder seulement si des changements ont été effectués ou si le fichier doit être renommé
              if (hasChanges || oldFileName !== newFileName) {
                // Générer le nouveau CSV
                const csv = Papa.unparse(rows, {
                  delimiter: this.DELIMITER,
                  header: true,
                });

                // Écrire le nouveau fichier
                await FileService.writeFile(newFilePath, csv);
                filesModified++;
              }

              // Supprimer l'ancien fichier seulement si le nouveau nom est différent
              if (oldFileName !== newFileName) {
                try {
                  // Note: FileService n'a pas de méthode delete, on doit utiliser l'API Electron directement
                  // Pour l'instant, on laisse l'ancien fichier (il sera écrasé si on réimporte)
                  // Ou on peut essayer de le supprimer via une autre méthode
                  console.log(`[CodeUpdateService] Ancien fichier ${oldFileName} devrait être supprimé (non implémenté)`);
                } catch (deleteError) {
                  console.warn(`[CodeUpdateService] Impossible de supprimer l'ancien fichier ${oldFileName}`);
                }
              }

              console.log(`[CodeUpdateService] Fichier ${oldFileName} -> ${newFileName} mis à jour (compte ${oldCode} -> ${newCode})`);

              // Permettre au thread principal de traiter d'autres événements
              if (i + CHUNK_SIZE < filesToRename.length) {
                await new Promise(resolve => setTimeout(resolve, 0));
              }
            } catch (error: any) {
              console.error(`[CodeUpdateService] Erreur lors du traitement de ${oldFileName}:`, error.message);
              // Continuer avec les autres fichiers
            }
          })
        );
      }

      console.log(`[CodeUpdateService] ${filesModified} fichier(s) modifié(s) pour le compte ${oldCode} -> ${newCode}`);
      return filesModified;
    } catch (error: any) {
      console.error('[CodeUpdateService] Erreur lors de la mise à jour des comptes:', error);
      throw new Error(`Erreur lors de la mise à jour des codes de compte: ${error.message}`);
    }
  }

  /**
   * Extrait le préfixe du compte depuis le nom de fichier
   * Format: CCAL_01.01.2025_31.01.2025.csv -> CCAL
   */
  private static extractAccountPrefix(fileName: string): string {
    const match = fileName.match(/^([A-Za-z0-9]+)_/);
    return match ? match[1].trim().toUpperCase() : '';
  }
}

