// Service pour l'édition des données CSV (compatible avec Comptal1)

import Papa from 'papaparse';
import { FileService } from './FileService';
import { ConfigService } from './ConfigService';
import { EditionRow, EditionData } from '../types/Edition';
import { parse, isValid } from 'date-fns';
import { AutoCategorisationService } from './AutoCategorisationService';

export class EditionService {
  private static readonly DELIMITER = ';';
  private static readonly REQUIRED_COLUMNS = [
    'Source',
    'Compte',
    'Date',
    'Date de valeur',
    'Débit',
    'Crédit',
    'Libellé',
    'Solde',
    'catégorie'
  ];

  /**
   * Extrait le préfixe du compte depuis le nom de fichier
   * Format: CCAL_01.01.2025_31.01.2025.csv -> CCAL
   */
  private static extractAccountPrefix(source: string): string {
    const match = source.match(/^([A-Za-z0-9]+)_/);
    return match ? match[1].trim().toUpperCase() : 'UNKNOWN';
  }

  /**
   * Filtre les sources selon les comptes bancaires connus
   */
  private static filterSource(source: string, bankAccounts: Record<string, any>): boolean {
    if (!source || typeof source !== 'string') {
      return false;
    }
    const prefix = this.extractAccountPrefix(source);
    return prefix in bankAccounts;
  }

  /**
   * Normalise les valeurs numériques
   */
  private static normalizeNumeric(value: any): number {
    if (typeof value === 'number') {
      return isNaN(value) ? 0 : value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(',', '.').replace(/\s/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * Normalise les débits (doivent être négatifs ou 0)
   */
  private static normalizeDebit(value: any): number {
    const num = this.normalizeNumeric(value);
    return num !== 0 ? -Math.abs(num) : 0;
  }

  /**
   * Normalise les crédits (doivent être positifs ou 0)
   */
  private static normalizeCredit(value: any): number {
    const num = this.normalizeNumeric(value);
    return num !== 0 ? Math.abs(num) : 0;
  }

  /**
   * Parse une date au format dd/MM/yyyy
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
   * Élimine les doublons dans les lignes basés sur les champs clés
   */
  private static deduplicateRows(rows: EditionRow[]): EditionRow[] {
    const seen = new Set<string>();
    const deduplicated: EditionRow[] = [];
    let duplicateCount = 0;

    for (const row of rows) {
      const key = `${row.Source}|${row.Date}|${row['Date de valeur']}|${row.Libellé}|${row.Débit}|${row.Crédit}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(row);
      } else {
        duplicateCount++;
        console.warn(`[EditionService] Doublon ignoré: ${row.Date} - ${row.Libellé}`);
      }
    }

    if (duplicateCount > 0) {
      console.log(`[EditionService] ${duplicateCount} doublon(s) éliminé(s)`);
    }

    return deduplicated;
  }

  /**
   * Charge toutes les données CSV pour l'édition
   */
  static async loadEditionData(): Promise<EditionData> {
    try {
      // Charger les comptes bancaires pour filtrer les sources
      const bankAccounts = await ConfigService.loadAccounts();
      
      // Lire tous les fichiers CSV du dossier data
      let files: string[] = [];
      try {
        files = await FileService.readDirectory('data');
      } catch (error: any) {
        // Si le dossier n'existe pas ou est vide, retourner une structure vide
        const errorMessage = error.message || String(error);
        if (errorMessage.includes('non trouvé') || errorMessage.includes('n\'existe pas') || errorMessage.includes('does not exist')) {
          console.warn('[EditionService] Le dossier data/ n\'existe pas ou est vide. Retour d\'une structure vide.');
          return {
            headers: this.REQUIRED_COLUMNS,
            rows: [],
          };
        }
        // Pour les autres erreurs, relancer
        throw error;
      }
      
      const csvFiles = files.filter(file => file.endsWith('.csv'));

      // Si aucun fichier CSV n'est trouvé, retourner une structure vide
      if (csvFiles.length === 0) {
        console.warn('[EditionService] Aucun fichier CSV trouvé dans le dossier data/. Retour d\'une structure vide.');
        return {
          headers: this.REQUIRED_COLUMNS,
          rows: [],
        };
      }

      const allRows: EditionRow[] = [];
      const fileMapping: Record<string, string> = {};
      let detectedHeaders: string[] = []; // Headers détectés dynamiquement

      // Créer un mapping nom complet -> nom complet (identité)
      // Cela évite les collisions quand plusieurs fichiers ont la même période de dates
      for (const fileName of csvFiles) {
        fileMapping[fileName] = fileName;
      }

      // Charger et parser chaque fichier CSV
      for (const fileName of csvFiles) {
        try {
          const filePath = `data/${fileName}`;
          const content = await FileService.readFile(filePath);

          // Extraire le préfixe du compte depuis le nom de fichier (comme Comptal1)
          const accountPrefix = this.extractAccountPrefix(fileName);
          
          // Vérifier que le compte existe dans les comptes bancaires connus
          if (!(accountPrefix in bankAccounts)) {
            console.warn(`[EditionService] Compte ${accountPrefix} non trouvé dans les comptes valides, fichier ${fileName} ignoré`);
            continue;
          }

          // Obtenir le nom complet du compte depuis la configuration
          const accountData = bankAccounts[accountPrefix];
          const accountFullName = typeof accountData === 'object' && accountData !== null && 'name' in accountData
            ? accountData.name
            : String(accountData || accountPrefix);

          console.log(`[EditionService] Chargement fichier ${fileName}: préfixe=${accountPrefix}, compte=${accountFullName}`);

          await new Promise<void>((resolve) => {
            Papa.parse(content, {
              header: true,
              delimiter: this.DELIMITER,
              skipEmptyLines: true,
              encoding: 'UTF-8',
              complete: (results) => {
                try {
                  // Détecter les headers du premier fichier
                  if (detectedHeaders.length === 0 && results.meta?.fields) {
                    detectedHeaders = results.meta.fields;
                    console.log(`[EditionService] Headers détectés: ${detectedHeaders.join(', ')}`);
                  }

                  for (let i = 0; i < results.data.length; i++) {
                    const row: any = results.data[i];
                    
                    // Vérifier que la source existe et est valide
                    let source = row['Source'] || fileName;
                    
                    // Si la source existe dans le mapping, l'utiliser, sinon utiliser le nom de fichier actuel
                    if (source && typeof source === 'string' && fileMapping[source]) {
                      source = fileMapping[source];
                    } else {
                      source = fileName;
                    }

                    // Filtrer selon les comptes bancaires connus
                    if (!this.filterSource(source, bankAccounts)) {
                      continue;
                    }

                    // Définir le Compte depuis le nom de fichier (comme Comptal1)
                    // Ne plus lire directement depuis le CSV pour éviter les incohérences
                    const compteFromFile = accountFullName;
                    const compteFromCSV = row['Compte'] || '';
                    
                    // Logger une incohérence si le Compte dans le CSV ne correspond pas
                    if (compteFromCSV && compteFromCSV !== compteFromFile) {
                      console.warn(
                        `[EditionService] Incohérence détectée dans ${fileName}, ligne ${i}: ` +
                        `Compte CSV="${compteFromCSV}" vs Compte attendu="${compteFromFile}" ` +
                        `(préfixe=${accountPrefix}). Le Compte sera corrigé automatiquement.`
                      );
                    }

                    // Créer la ligne d'édition avec TOUTES les colonnes détectées
                    const editionRow: EditionRow = {
                      Source: source,
                      Compte: compteFromFile, // Toujours utiliser le compte dérivé du nom de fichier
                      Date: row['Date'] || '',
                      'Date de valeur': row['Date de valeur'] || row['Date'] || '',
                      Débit: this.normalizeDebit(row['Débit']),
                      Crédit: this.normalizeCredit(row['Crédit']),
                      Libellé: row['Libellé'] || '',
                      Solde: this.normalizeNumeric(row['Solde']),
                      catégorie: row['catégorie'] || '',
                      rowIndex: i,
                      modified: false,
                      deleted: false,
                    };

                    // Copier toutes les autres colonnes détectées (Solde initial, Index, etc.)
                    for (const header of detectedHeaders) {
                      if (!(header in editionRow) && row[header] !== undefined) {
                        // Normaliser les colonnes numériques spéciales
                        if (header === 'Solde initial') {
                          editionRow[header] = this.normalizeNumeric(row[header]);
                        } else {
                          editionRow[header] = row[header] || '';
                        }
                      }
                    }

                    allRows.push(editionRow);
                  }
                  resolve();
                } catch (error) {
                  console.error(`Erreur lors du traitement du fichier ${fileName}:`, error);
                  resolve(); // Continuer avec les autres fichiers
                }
              },
              error: (error: Error) => {
                console.error(`Erreur lors du parsing de ${fileName}:`, error);
                resolve(); // Continuer avec les autres fichiers
              },
            });
          });
        } catch (error: any) {
          console.error(`Erreur lors de la lecture de ${fileName}:`, error.message);
          // Continuer avec les autres fichiers
        }
      }

      // Dédupliquer avant de retourner
      console.log(`[EditionService] Lignes avant déduplication: ${allRows.length}`);
      const deduplicatedRows = this.deduplicateRows(allRows);
      console.log(`[EditionService] Lignes après déduplication: ${deduplicatedRows.length}`);

      // Utiliser les headers détectés ou fallback sur REQUIRED_COLUMNS
      const finalHeaders = detectedHeaders.length > 0 ? detectedHeaders : this.REQUIRED_COLUMNS;

      // Si aucune ligne n'a été chargée (tous les fichiers ignorés), retourner une structure vide
      if (deduplicatedRows.length === 0) {
        console.warn('[EditionService] Aucune ligne chargée (tous les fichiers ignorés ou vides). Retour d\'une structure vide.');
        return {
          headers: finalHeaders.length > 0 ? finalHeaders : this.REQUIRED_COLUMNS,
          rows: [],
        };
      }

      return {
        headers: finalHeaders,
        rows: deduplicatedRows,
      };
    } catch (error: any) {
      // En cas d'erreur, retourner une structure vide au lieu de lancer une erreur
      console.warn('[EditionService] Erreur lors du chargement des données d\'édition, retour d\'une structure vide:', error.message);
      return {
        headers: this.REQUIRED_COLUMNS,
        rows: [],
      };
    }
  }

  /**
   * Sauvegarde les données éditées dans les fichiers CSV d'origine
   */
  static async saveEditionData(rows: EditionRow[]): Promise<void> {
    try {
      // Filtrer les lignes actives (non supprimées)
      const activeRows = rows.filter(row => !row.deleted);

      // Charger les comptes pour convertir les noms complets en abréviations
      const bankAccounts = await ConfigService.loadAccounts();
      const abbreviationsReverse: Record<string, string> = {};
      for (const [abbr, data] of Object.entries(bankAccounts)) {
        const name = typeof data === 'object' && data !== null && 'name' in data
          ? data.name
          : String(data);
        abbreviationsReverse[name] = abbr;
      }

      // Normaliser et préparer les lignes actives
      const normalizedRows = activeRows.map(row => {
        const normalized: EditionRow = { ...row };

        // Normaliser les débits et crédits
        normalized.Débit = this.normalizeDebit(row.Débit);
        normalized.Crédit = this.normalizeCredit(row.Crédit);
        normalized.Solde = this.normalizeNumeric(row.Solde);

        // Convertir les valeurs numériques en string pour le CSV
        normalized.Débit = normalized.Débit === 0 ? '0' : String(normalized.Débit);
        normalized.Crédit = normalized.Crédit === 0 ? '0' : String(normalized.Crédit);
        normalized.Solde = String(normalized.Solde);

        // Convertir la catégorie si c'est un nom complet
        if (normalized.catégorie && abbreviationsReverse[normalized.catégorie]) {
          normalized.catégorie = abbreviationsReverse[normalized.catégorie];
        }

        return normalized;
      });

      // Dédupliquer avant de grouper et sauvegarder
      console.log(`[EditionService] Lignes avant déduplication: ${normalizedRows.length}`);
      const deduplicatedRows = this.deduplicateRows(normalizedRows);
      console.log(`[EditionService] Lignes après déduplication: ${deduplicatedRows.length}`);

      // Grouper les données par source (fichier CSV)
      const groupedData: Record<string, EditionRow[]> = {};
      for (const row of deduplicatedRows) {
        const source = row.Source;
        if (!groupedData[source]) {
          groupedData[source] = [];
        }
        groupedData[source].push(row);
      }

      // Sauvegarder chaque fichier séparément
      for (const [source, fileRows] of Object.entries(groupedData)) {
        try {
          // Si le fichier est vide (toutes les lignes supprimées), passer au suivant
          if (fileRows.length === 0) {
            console.log(`[EditionService] Aucune ligne active pour la source ${source}, fichier ignoré`);
            continue;
          }

          // VALIDATION : Vérifier la cohérence Source/Compte (comme Comptal1)
          const expectedPrefix = this.extractAccountPrefix(source);
          const expectedAccountData = bankAccounts[expectedPrefix];
          const expectedAccountName = expectedAccountData && typeof expectedAccountData === 'object' && 'name' in expectedAccountData
            ? expectedAccountData.name
            : String(expectedAccountData || expectedPrefix);

          console.log(`[EditionService] Validation sauvegarde ${source}: préfixe attendu=${expectedPrefix}, compte attendu=${expectedAccountName}`);

          // Détecter les incohérences
          const inconsistentRows: { index: number; compte: string; expected: string }[] = [];
          const compteGroups: Record<string, EditionRow[]> = {};

          for (let i = 0; i < fileRows.length; i++) {
            const row = fileRows[i];
            if (row.Compte !== expectedAccountName) {
              inconsistentRows.push({
                index: i,
                compte: row.Compte,
                expected: expectedAccountName
              });
              
              // Grouper par compte pour séparation si nécessaire
              if (!compteGroups[row.Compte]) {
                compteGroups[row.Compte] = [];
              }
              compteGroups[row.Compte].push(row);
            }
          }

          // Si des incohérences sont détectées, les logger et séparer par compte
          if (inconsistentRows.length > 0) {
            console.error(
              `[EditionService] INCOHÉRENCE DÉTECTÉE dans ${source}: ` +
              `${inconsistentRows.length} ligne(s) avec un Compte incohérent. ` +
              `Compte attendu: "${expectedAccountName}" (préfixe: ${expectedPrefix})`
            );
            
            for (const inconsistency of inconsistentRows) {
              console.error(
                `[EditionService]   - Ligne ${inconsistency.index}: ` +
                `Compte="${inconsistency.compte}" (attendu: "${inconsistency.expected}")`
              );
            }

            // Séparer les lignes par compte si nécessaire
            if (Object.keys(compteGroups).length > 1) {
              console.warn(
                `[EditionService] Séparation des lignes par compte pour ${source}. ` +
                `Comptes détectés: ${Object.keys(compteGroups).join(', ')}`
              );

              // Sauvegarder chaque groupe de compte dans un fichier séparé
              for (const [compte, compteRows] of Object.entries(compteGroups)) {
                const comptePrefix = Object.entries(bankAccounts).find(
                  ([_, data]) => {
                    const name = typeof data === 'object' && data !== null && 'name' in data
                      ? data.name
                      : String(data);
                    return name === compte;
                  }
                )?.[0] || expectedPrefix;

                // Générer un nouveau nom de fichier pour ce compte
                const datePart = source.split('_').slice(1).join('_');
                const newSource = `${comptePrefix}_${datePart}`;

                console.log(
                  `[EditionService] Création fichier séparé: ${newSource} ` +
                  `pour ${compteRows.length} ligne(s) du compte "${compte}"`
                );

                // Trier par date
                compteRows.sort((a, b) => {
                  const dateA = this.parseDate(a.Date);
                  const dateB = this.parseDate(b.Date);
                  if (!dateA || !dateB) return 0;
                  return dateA.getTime() - dateB.getTime();
                });

          // Préparer les données pour Papa.unparse avec toutes les colonnes
          const csvData = compteRows.map(row => {
            const csvRow: any = {
              Source: newSource,
              Compte: compte, // Utiliser le compte tel quel
              Date: row.Date,
              'Date de valeur': row['Date de valeur'],
              Débit: String(row.Débit),
              Crédit: String(row.Crédit),
              Libellé: row.Libellé,
              Solde: String(row.Solde),
              catégorie: row.catégorie || '',
            };
            
            // Copier toutes les autres colonnes (Solde initial, Index, etc.)
            for (const key of Object.keys(row)) {
              if (key !== 'rowIndex' && key !== 'modified' && key !== 'deleted' && !(key in csvRow)) {
                csvRow[key] = row[key];
              }
            }
            
            return csvRow;
          });

                // Générer le CSV
                const csv = Papa.unparse(csvData, {
                  delimiter: this.DELIMITER,
                  header: true,
                });

                // Sauvegarder le fichier
                const filePath = `data/${newSource}`;
                await FileService.writeFile(filePath, csv);
                console.log(`[EditionService] Fichier ${newSource} sauvegardé avec succès (${compteRows.length} lignes)`);
              }

              // Continuer avec le fichier suivant (les lignes incohérentes ont été séparées)
              continue;
            } else {
              // Une seule incohérence : corriger automatiquement
              console.warn(
                `[EditionService] Correction automatique: toutes les lignes de ${source} ` +
                `seront corrigées avec le compte "${expectedAccountName}"`
              );
              for (const row of fileRows) {
                row.Compte = expectedAccountName;
              }
            }
          }

          // Trier par date (du plus ancien au plus récent)
          fileRows.sort((a, b) => {
            const dateA = this.parseDate(a.Date);
            const dateB = this.parseDate(b.Date);
            if (!dateA || !dateB) return 0;
            return dateA.getTime() - dateB.getTime();
          });

          // Préparer les données pour Papa.unparse avec toutes les colonnes
          const csvData = fileRows.map(row => {
            const csvRow: any = {
              Source: row.Source,
              Compte: row.Compte,
              Date: row.Date,
              'Date de valeur': row['Date de valeur'],
              Débit: String(row.Débit),
              Crédit: String(row.Crédit),
              Libellé: row.Libellé,
              Solde: String(row.Solde),
              catégorie: row.catégorie || '',
            };
            
            // Copier toutes les autres colonnes (Solde initial, Index, etc.)
            for (const key of Object.keys(row)) {
              if (key !== 'rowIndex' && key !== 'modified' && key !== 'deleted' && !(key in csvRow)) {
                csvRow[key] = row[key];
              }
            }
            
            return csvRow;
          });

          // Générer le CSV
          const csv = Papa.unparse(csvData, {
            delimiter: this.DELIMITER,
            header: true,
          });

          // Sauvegarder le fichier
          const filePath = `data/${source}`;
          await FileService.writeFile(filePath, csv);

          console.log(`[EditionService] Fichier ${source} sauvegardé avec succès (${fileRows.length} lignes)`);
        } catch (error: any) {
          console.error(`Erreur lors de la sauvegarde du fichier ${source}:`, error);
          throw new Error(`Erreur lors de la sauvegarde du fichier ${source}: ${error.message}`);
        }
      }
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde des données:', error);
      throw new Error(`Erreur lors de la sauvegarde: ${error.message}`);
    }
  }

  /**
   * Nettoie les fichiers CSV en supprimant les doublons et corrigeant les incohérences Source/Compte
   */
  static async cleanDuplicateCSVFiles(): Promise<{
    cleaned: number;
    filesProcessed: number;
    inconsistenciesFixed: number;
  }> {
    try {
      const files = await FileService.readDirectory('data');
      const csvFiles = files.filter(file => file.endsWith('.csv'));
      const bankAccounts = await ConfigService.loadAccounts();
      
      let totalCleaned = 0;
      let filesProcessed = 0;
      let inconsistenciesFixed = 0;

      for (const fileName of csvFiles) {
        try {
          const filePath = `data/${fileName}`;
          const content = await FileService.readFile(filePath);
          
          const result = await new Promise<any>((resolve) => {
            Papa.parse(content, {
              header: true,
              delimiter: this.DELIMITER,
              skipEmptyLines: true,
              complete: resolve,
            });
          });

          const rows = result.data;
          const originalCount = rows.length;
          
          // Extraire le compte attendu du nom de fichier
          const prefix = this.extractAccountPrefix(fileName);
          if (!(prefix in bankAccounts)) {
            console.warn(`[EditionService] Préfixe ${prefix} non trouvé pour ${fileName}, fichier ignoré`);
            continue;
          }
          
          const accountData = bankAccounts[prefix];
          const expectedAccount = typeof accountData === 'object' && accountData !== null && 'name' in accountData
            ? accountData.name
            : String(accountData || prefix);
          
          // Dédupliquer ET corriger le Compte
          const seen = new Set<string>();
          const deduplicated: any[] = [];
          let fileInconsistenciesFixed = 0;
          
          for (const row of rows) {
            const key = `${row.Date}|${row['Date de valeur']}|${row.Libellé}|${row.Débit}|${row.Crédit}`;
            
            if (!seen.has(key)) {
              seen.add(key);
              
              // Corriger le Compte si nécessaire
              if (row.Compte !== expectedAccount) {
                fileInconsistenciesFixed++;
                row.Compte = expectedAccount;
              }
              
              // Corriger aussi la Source
              row.Source = fileName;
              
              deduplicated.push(row);
            }
          }

          const cleanedCount = originalCount - deduplicated.length;
          
          if (cleanedCount > 0 || fileInconsistenciesFixed > 0) {
            // Générer le CSV avec toutes les colonnes présentes
            const csv = Papa.unparse(deduplicated, {
              delimiter: this.DELIMITER,
              header: true,
            });
            
            await FileService.writeFile(filePath, csv);
            console.log(
              `[EditionService] ${fileName}: ${cleanedCount} doublon(s) supprimé(s), ` +
              `${fileInconsistenciesFixed} incohérence(s) corrigée(s)`
            );
            totalCleaned += cleanedCount;
            inconsistenciesFixed += fileInconsistenciesFixed;
            filesProcessed++;
          }
        } catch (error: any) {
          console.error(`[EditionService] Erreur lors du nettoyage de ${fileName}:`, error);
          // Continuer avec les autres fichiers
        }
      }

      return { cleaned: totalCleaned, filesProcessed, inconsistenciesFixed };
    } catch (error: any) {
      console.error('Erreur lors du nettoyage des fichiers:', error);
      throw new Error(`Erreur lors du nettoyage: ${error.message}`);
    }
  }

  /**
   * Reconstruit les statistiques d'auto-catégorisation à partir de toutes les lignes catégorisées des CSV
   */
  static async rebuildAutoCategorisationStats(): Promise<{ processed: number; statsCount: number }> {
    try {
      // Charger toutes les données d'édition
      const editionData = await this.loadEditionData();
      
      // Filtrer les lignes avec une catégorie valide (non vide et différente de '???')
      const categorizedRows = editionData.rows.filter(row => {
        const category = row.catégorie || '';
        return category.trim() !== '' && category !== '???';
      });

      // Construire la liste des labels et catégories
      const labelCategoryPairs = categorizedRows.map(row => ({
        label: row.Libellé || '',
        category: row.catégorie || '',
      }));

      // Reconstruire les stats à partir de zéro
      const emptyStats = {};
      const rebuiltStats = AutoCategorisationService.batchUpdateStats(labelCategoryPairs, emptyStats);

      // Sauvegarder les stats reconstruites
      await ConfigService.saveAutoCategorisationStats(rebuiltStats);

      // Compter le nombre de mots uniques dans les stats
      const statsCount = Object.keys(rebuiltStats).length;

      return {
        processed: categorizedRows.length,
        statsCount,
      };
    } catch (error: any) {
      console.error('Erreur lors de la reconstruction des stats d\'auto-catégorisation:', error);
      throw new Error(`Erreur lors de la reconstruction: ${error.message}`);
    }
  }
}

