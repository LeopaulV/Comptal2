// Service pour transformer les données au format standardisé Comptal2

import { FileStructure, DetectedColumns } from '../types/FileAnalysis';
import { ColumnMappingConfig, TransformedRow, ImportConfig } from '../types/ColumnMapping';
import { ColumnMappingService } from './ColumnMappingService';
import { FileDetectionService } from './FileDetectionService';
import { ExcelSheetService } from './ExcelSheetService';
import { format, parse, isValid } from 'date-fns';
import Papa from 'papaparse';

export class CSVTransformService {
  /**
   * Transforme les données brutes en format standardisé Comptal2
   */
  static async transformData(
    file: File,
    structure: FileStructure,
    _detectedColumns: DetectedColumns,
    mapping: ColumnMappingConfig,
    config: ImportConfig,
    sheetName?: string // Pour Excel, nom de la feuille à utiliser
  ): Promise<TransformedRow[]> {
    console.log('[Import] Début transformation données:', {
      compte: config.accountCode,
      feuille: sheetName || 'N/A',
      soldeInitial: config.initialBalance,
      mapping: {
        date: mapping.dateColumnIndex,
        debit: mapping.debitColumnIndex,
        credit: mapping.creditColumnIndex,
        libelle: mapping.libelleColumnIndex
      }
    });

    // VALIDATION : Vérifier la cohérence accountCode/accountName
    // Le accountName devrait correspondre au compte associé au accountCode
    if (!config.accountCode || !config.accountName) {
      console.warn(
        `[Import] ATTENTION: accountCode ou accountName manquant. ` +
        `accountCode="${config.accountCode}", accountName="${config.accountName}"`
      );
    } else {
      console.log(
        `[Import] Validation cohérence: accountCode="${config.accountCode}", ` +
        `accountName="${config.accountName}"`
      );
    }

    // Utiliser les données en cache si disponibles, sinon relire le fichier
    let rows: any[][];
    
    if (structure.rawData && structure.rawData.length > 0) {
      console.log('[Import] Utilisation des données en cache:', {
        lignes: structure.rawData.length,
        source: 'cache'
      });
      rows = structure.rawData;
    } else if (structure.fileType === 'csv') {
      console.log('[Import] Lecture CSV (pas de cache)...');
      rows = await FileDetectionService.parseCSV(file, structure.delimiter || ';');
      console.log('[Import] CSV lu, lignes:', rows.length);
    } else {
      // Pour Excel, utiliser ExcelSheetService qui est optimisé
      if (!sheetName) {
        throw new Error('Le nom de la feuille est requis pour les fichiers Excel');
      }
      console.log('[Import] Lecture feuille Excel via ExcelSheetService (pas de cache):', sheetName);
      try {
        rows = await ExcelSheetService.parseSheet(file, sheetName);
        console.log('[Import] Feuille Excel lue, lignes:', rows.length);
      } catch (error: any) {
        console.error('[Import] Erreur lors de la lecture de la feuille Excel:', error);
        throw new Error(`Impossible de lire la feuille "${sheetName}": ${error.message}`);
      }
    }

    // Extraire uniquement les lignes de données (après dataStartRowIndex)
    const dataRows = rows.slice(structure.dataStartRowIndex);
    console.log('[Import] Lignes de données à transformer:', {
      total: dataRows.length,
      debutIndex: structure.dataStartRowIndex,
      colonneUnique: mapping.debitColumnIndex === mapping.creditColumnIndex
    });

    const transformedRows: TransformedRow[] = [];
    let currentBalance = config.initialBalance;

    // Générer le nom du fichier source
    const startDateObj = parse(config.startDate, 'yyyy-MM-dd', new Date());
    const endDateObj = parse(config.endDate, 'yyyy-MM-dd', new Date());
    const sourceFileName = `${config.accountCode}_${format(startDateObj, 'dd.MM.yyyy')}_${format(endDateObj, 'dd.MM.yyyy')}.csv`;

    const isSingleAmountColumn = mapping.debitColumnIndex === mapping.creditColumnIndex;
    console.log('[Import] Type de colonne montant:', {
      unique: isSingleAmountColumn,
      index: isSingleAmountColumn ? mapping.debitColumnIndex : `${mapping.debitColumnIndex}/${mapping.creditColumnIndex}`
    });

    let rowIndex = 0;
    let skippedRows = 0;
    for (const row of dataRows) {
      if (!row || row.length === 0) {
        skippedRows++;
        continue;
      }

      try {
        // Extraire les valeurs selon le mapping
        const dateValue = row[mapping.dateColumnIndex];
        const dateValueValue = mapping.dateValueColumnIndex !== undefined 
          ? row[mapping.dateValueColumnIndex] 
          : dateValue;
        const libelleValue = row[mapping.libelleColumnIndex];
        const amountValue = row[mapping.debitColumnIndex]; // Utiliser la même colonne pour les deux si unique

        // Parser la date
        const date = ColumnMappingService.parseDate(dateValue);
        if (!date || !isValid(date)) {
          skippedRows++;
          if (rowIndex < 5) {
            console.log('[Import] Ligne ignorée (date invalide):', {
              ligne: rowIndex + structure.dataStartRowIndex,
              valeurDate: dateValue
            });
          }
          continue; // Ignorer les lignes sans date valide
        }

        const dateValueParsed = ColumnMappingService.parseDate(dateValueValue) || date;

        // Parser les montants selon le type de colonne
        let debit = 0;
        let credit = 0;

        if (isSingleAmountColumn) {
          // Colonne unique : un seul montant avec signe
          const amount = ColumnMappingService.parseNumber(amountValue);
          if (amount < 0) {
            debit = amount; // Garder négatif pour débit
          } else if (amount > 0) {
            credit = amount; // Garder positif pour crédit
          }
          // Si amount === 0, les deux restent à 0
        } else {
          // Deux colonnes séparées
          const debitValue = row[mapping.debitColumnIndex];
          const creditValue = row[mapping.creditColumnIndex];
          debit = ColumnMappingService.parseNumber(debitValue);
          credit = ColumnMappingService.parseNumber(creditValue);
          
          // Normaliser les signes : débit négatif, crédit positif
          if (debit > 0) debit = -debit;
          if (credit < 0) credit = Math.abs(credit);
        }

        if (rowIndex < 5) {
          console.log('[Import] Ligne transformée:', {
            ligne: rowIndex,
            date: format(date, 'dd/MM/yyyy'),
            debit,
            credit,
            libelle: String(libelleValue || '').substring(0, 30)
          });
        }

        // Calculer le solde
        currentBalance = currentBalance + credit + debit; // debit est déjà négatif
        const solde = Math.round(currentBalance * 100) / 100;

        // Générer l'index
        const dateStr = format(date, 'yyyyMMdd');
        const soldeAbsolu = Math.abs(Math.round(solde));
        const index = `${dateStr},${soldeAbsolu}`;

        const transformedRow: TransformedRow = {
          Source: sourceFileName,
          Compte: config.accountName,
          Date: format(date, 'dd/MM/yyyy'),
          'Date de valeur': format(dateValueParsed, 'dd/MM/yyyy'),
          Débit: Math.round(debit * 100) / 100,
          Crédit: Math.round(credit * 100) / 100,
          Libellé: String(libelleValue || '').trim(),
          Solde: solde,
          catégorie: '',
          'Solde initial': rowIndex === 0 ? config.initialBalance : '',
          Index: index,
        };

        transformedRows.push(transformedRow);
        rowIndex++;
      } catch (error: any) {
        skippedRows++;
        console.error('[Import] Erreur lors de la transformation de la ligne:', {
          ligne: rowIndex + structure.dataStartRowIndex,
          erreur: error.message
        });
        continue;
      }
    }

    console.log('[Import] Transformation première passe terminée:', {
      transformees: transformedRows.length,
      ignorees: skippedRows,
      soldeFinal: transformedRows.length > 0 ? transformedRows[transformedRows.length - 1].Solde : 0
    });

    // Trier par date
    console.log('[Import] Tri des transactions par date...');
    transformedRows.sort((a, b) => {
      const dateA = parse(a.Date, 'dd/MM/yyyy', new Date());
      const dateB = parse(b.Date, 'dd/MM/yyyy', new Date());
      return dateA.getTime() - dateB.getTime();
    });
    console.log('[Import] Tri terminé, recalcul des soldes...');

    // Recalculer les soldes après le tri avec le solde initial fourni
    currentBalance = config.initialBalance;
    console.log('[Import] Recalcul des soldes avec solde initial:', config.initialBalance);
    
    // Réinitialiser tous les soldes pour recalculer depuis le début
    for (let i = 0; i < transformedRows.length; i++) {
      const row = transformedRows[i];
      // Le solde est calculé en ajoutant crédit (positif) et débit (négatif) au solde précédent
      currentBalance = currentBalance + row.Crédit + row.Débit;
      row.Solde = Math.round(currentBalance * 100) / 100;
      
      // Mettre à jour l'index avec le nouveau solde
      const dateStr = row.Date.replace(/\//g, '');
      const soldeAbsolu = Math.abs(Math.round(row.Solde));
      row.Index = `${dateStr},${soldeAbsolu}`;
      
      // Mettre à jour le solde initial uniquement pour la première ligne
      if (i === 0) {
        row['Solde initial'] = config.initialBalance;
      } else {
        row['Solde initial'] = '';
      }
    }

    // Extraire les dates min/max pour le log
    if (transformedRows.length > 0) {
      const dates = transformedRows.map(row => parse(row.Date, 'dd/MM/yyyy', new Date()));
      const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
      
      console.log('[Import] Transformation terminée:', {
        transactions: transformedRows.length,
        dateMin: format(minDate, 'dd/MM/yyyy'),
        dateMax: format(maxDate, 'dd/MM/yyyy'),
        soldeFinal: transformedRows.length > 0 ? transformedRows[transformedRows.length - 1].Solde : 0
      });
    }

    return transformedRows;
  }

  /**
   * Génère un CSV au format standardisé Comptal2
   */
  static generateCSV(rows: TransformedRow[]): string {
    const csv = Papa.unparse(rows, {
      delimiter: ';',
      header: true,
    });
    return csv;
  }

  /**
   * Crée un mapping de colonnes à partir de la détection automatique
   */
  static createMappingFromDetection(
    detectedColumns: DetectedColumns,
    manualMapping?: { debitColumnIndex: number; creditColumnIndex: number }
  ): ColumnMappingConfig {
    if (!detectedColumns.dateColumn || !detectedColumns.libelleColumn) {
      throw new Error('Colonnes essentielles manquantes');
    }

    let debitIndex: number;
    let creditIndex: number;

    if (manualMapping) {
      // Utiliser le mapping manuel fourni
      debitIndex = manualMapping.debitColumnIndex;
      creditIndex = manualMapping.creditColumnIndex;
      console.log('[Import] Mapping manuel utilisé:', {
        debit: debitIndex,
        credit: creditIndex,
        colonneUnique: debitIndex === creditIndex
      });
    } else if (detectedColumns.amountColumns.length === 1) {
      // Une seule colonne de montant: utiliser pour débit et crédit
      const singleCol = detectedColumns.amountColumns[0];
      debitIndex = singleCol.index;
      creditIndex = singleCol.index;
      
      console.log('[Import] Colonne montant unique détectée:', {
        index: singleCol.index,
        nom: singleCol.name,
        aValeursNegatives: singleCol.hasNegativeValues,
        aValeursPositives: singleCol.hasPositiveValues,
        type: detectedColumns.amountColumnType || 'single'
      });
    } else if (detectedColumns.amountColumns.length === 2) {
      // Deux colonnes: déterminer automatiquement
      const col1 = detectedColumns.amountColumns[0];
      const col2 = detectedColumns.amountColumns[1];

      if (col1.hasNegativeValues && !col2.hasNegativeValues) {
        // col1 = débit, col2 = crédit
        debitIndex = col1.index;
        creditIndex = col2.index;
        console.log('[Import] Colonnes séparées détectées (col1=débit, col2=crédit):', {
          debit: { index: col1.index, nom: col1.name },
          credit: { index: col2.index, nom: col2.name }
        });
      } else if (col2.hasNegativeValues && !col1.hasNegativeValues) {
        // col2 = débit, col1 = crédit
        debitIndex = col2.index;
        creditIndex = col1.index;
        console.log('[Import] Colonnes séparées détectées (col2=débit, col1=crédit):', {
          debit: { index: col2.index, nom: col2.name },
          credit: { index: col1.index, nom: col1.name }
        });
      } else {
        // Par défaut, première = débit, deuxième = crédit
        debitIndex = col1.index;
        creditIndex = col2.index;
        console.log('[Import] Colonnes séparées détectées (par défaut):', {
          debit: { index: col1.index, nom: col1.name },
          credit: { index: col2.index, nom: col2.name }
        });
      }
    } else {
      throw new Error(`Nombre de colonnes de montants invalide: ${detectedColumns.amountColumns.length} (attendu: 1 ou 2)`);
    }

    const mapping: ColumnMappingConfig = {
      dateColumnIndex: detectedColumns.dateColumn.index,
      dateValueColumnIndex: detectedColumns.dateValueColumn?.index,
      libelleColumnIndex: detectedColumns.libelleColumn.index,
      debitColumnIndex: debitIndex,
      creditColumnIndex: creditIndex,
      balanceColumnIndex: detectedColumns.balanceColumn?.index,
    };

    console.log('[Import] Mapping créé:', {
      date: mapping.dateColumnIndex,
      dateValeur: mapping.dateValueColumnIndex,
      libelle: mapping.libelleColumnIndex,
      debit: mapping.debitColumnIndex,
      credit: mapping.creditColumnIndex,
      colonneUnique: mapping.debitColumnIndex === mapping.creditColumnIndex
    });

    return mapping;
  }

  /**
   * Extrait les dates min et max depuis les données transformées
   */
  static extractDateRange(rows: TransformedRow[]): { startDate: string; endDate: string } {
    if (rows.length === 0) {
      throw new Error('Aucune donnée à traiter');
    }

    const dates = rows.map(row => parse(row.Date, 'dd/MM/yyyy', new Date()));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    return {
      startDate: format(minDate, 'yyyy-MM-dd'),
      endDate: format(maxDate, 'yyyy-MM-dd'),
    };
  }
}

