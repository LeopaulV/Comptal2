// Service pour identifier et mapper les colonnes

import { FileStructure, DetectedColumns, FileAnalysisResult } from '../types/FileAnalysis';
import { parseDateWithMultipleFormats } from '../utils/dateFormats';

export class ColumnMappingService {
  /**
   * Identifie automatiquement les colonnes importantes
   */
  static detectColumns(structure: FileStructure): DetectedColumns {
    const detected: DetectedColumns = {
      amountColumns: [],
      otherColumns: [],
    };

    // 1. Identifier les colonnes de dates
    const dateColumns = structure.columns.filter(col => col.type === 'date');
    if (dateColumns.length > 0) {
      detected.dateColumn = dateColumns[0];
      if (dateColumns.length > 1) {
        detected.dateValueColumn = dateColumns[1];
      } else {
        detected.dateValueColumn = dateColumns[0]; // Utiliser la même colonne
      }
    }

    // 2. Identifier la colonne Libellé (texte le plus long)
    const textColumns = structure.columns.filter(col => col.type === 'text');
    if (textColumns.length > 0) {
      // Calculer la longueur moyenne pour chaque colonne texte
      const textColumnsWithLength = textColumns.map(col => {
        const avgLength = col.sampleValues.reduce((sum, val) => sum + val.length, 0) / col.sampleValues.length;
        return { col, avgLength };
      });

      // Prendre celle avec la longueur moyenne la plus élevée
      const longestTextColumn = textColumnsWithLength.reduce((max, current) =>
        current.avgLength > max.avgLength ? current : max
      );
      detected.libelleColumn = longestTextColumn.col;
    }

    // 3. Identifier les colonnes numériques (montants)
    const numericColumns = structure.columns.filter(col => col.type === 'number');
    
    console.log(`[Import] Colonnes numériques trouvées: ${numericColumns.length}`, 
      numericColumns.map(c => ({ name: c.name, isMonotonic: c.isMonotonic, index: c.index })));
    
    // Séparer les colonnes avec progression monotone (probablement le solde)
    // Avec peu de données, être plus strict : ne considérer comme monotone que si vraiment clair
    const monotonicColumns = numericColumns.filter(col => col.isMonotonic === true);
    const nonMonotonicColumns = numericColumns.filter(col => col.isMonotonic !== true);

    console.log(`[Import] Colonnes monotones: ${monotonicColumns.length}, non-monotones: ${nonMonotonicColumns.length}`);

    // Identifier le solde (colonne monotone)
    if (monotonicColumns.length > 0) {
      detected.balanceColumn = monotonicColumns[0];
      console.log(`[Import] Colonne solde détectée: ${detected.balanceColumn.name}`);
    }

    // Les colonnes de montants sont les colonnes numériques non monotones
    detected.amountColumns = nonMonotonicColumns;
    
    // FALLBACK : Si aucune colonne de montant n'est détectée mais qu'il y a des colonnes numériques
    if (detected.amountColumns.length === 0 && numericColumns.length > 0) {
      console.log('[Import] Aucune colonne de montant détectée, utilisation du fallback');
      
      // Exclure les colonnes qui sont clairement des dates (ne devrait pas arriver mais sécurité)
      // Exclure la colonne solde si détectée
      const potentialAmountColumns = numericColumns.filter(col => {
        if (col === detected.balanceColumn) {
          console.log(`[Import] Exclusion colonne ${col.name}: colonne solde`);
          return false;
        }
        // Inclure toutes les autres colonnes numériques
        return true;
      });
      
      if (potentialAmountColumns.length > 0) {
        console.log(`[Import] Fallback: ${potentialAmountColumns.length} colonne(s) numérique(s) utilisée(s) comme colonne(s) de montant`);
        detected.amountColumns = potentialAmountColumns;
      } else {
        console.warn('[Import] Aucune colonne de montant trouvée même avec le fallback');
      }
    }

    // Amélioration : Si une seule colonne avec uniquement des valeurs négatives est trouvée,
    // chercher activement une colonne avec des valeurs positives pour le crédit
    if (detected.amountColumns.length === 1) {
      const singleCol = detected.amountColumns[0];
      
      // Si la colonne a des valeurs négatives ET positives, c'est une colonne unique
      if (singleCol.hasNegativeValues && singleCol.hasPositiveValues) {
        detected.amountColumnType = 'single';
        console.log('[Import] Colonne montant unique détectée:', singleCol.name);
      } else if (singleCol.hasNegativeValues && !singleCol.hasPositiveValues) {
        // Colonne avec uniquement des valeurs négatives (Débit)
        // Chercher une colonne Crédit dans toutes les colonnes numériques (y compris monotones)
        const creditCandidates = numericColumns.filter(col => 
          col !== singleCol && 
          col.hasPositiveValues && 
          !col.hasNegativeValues
        );
        
        if (creditCandidates.length > 0) {
          // Trouvé une colonne crédit potentielle
          detected.amountColumns.push(creditCandidates[0]);
          detected.amountColumnType = 'split';
          console.log('[Import] Colonnes Débit/Crédit séparées détectées:', {
            debit: singleCol.name,
            credit: creditCandidates[0].name
          });
        } else {
          // Aucune colonne crédit trouvée, marquer comme nécessitant confirmation
          detected.amountColumnType = 'split';
          console.log('[Import] Colonne Débit détectée mais aucune colonne Crédit trouvée:', singleCol.name);
        }
      } else {
        // Colonne avec uniquement des valeurs positives ou aucune valeur
        detected.amountColumnType = 'split';
      }
    } else if (detected.amountColumns.length === 2) {
      detected.amountColumnType = 'split';
    } else if (detected.amountColumns.length > 2) {
      // Plus de 2 colonnes : garder les 2 premières pour l'instant
      detected.amountColumns = detected.amountColumns.slice(0, 2);
      detected.amountColumnType = 'split';
    }

    // 4. Autres colonnes
    detected.otherColumns = structure.columns.filter(col => {
      if (col === detected.dateColumn || col === detected.dateValueColumn) return false;
      if (col === detected.libelleColumn) return false;
      if (detected.amountColumns.includes(col)) return false;
      if (col === detected.balanceColumn) return false;
      return true;
    });

    console.log('[Import] Colonnes détectées:', {
      date: detected.dateColumn?.name || 'N/A',
      dateValeur: detected.dateValueColumn?.name || 'N/A',
      libelle: detected.libelleColumn?.name || 'N/A',
      montants: detected.amountColumns.map(c => c.name),
      typeMontant: detected.amountColumnType || 'N/A',
      solde: detected.balanceColumn?.name || 'N/A',
      autres: detected.otherColumns.length
    });

    return detected;
  }

  /**
   * Analyse un fichier et retourne le résultat avec détection automatique
   */
  static analyzeFile(structure: FileStructure): FileAnalysisResult {
    const detectedColumns = this.detectColumns(structure);

    // Déterminer si un mapping manuel est nécessaire
    // Cas: deux colonnes numériques sans valeurs négatives (toutes deux positives)
    // OU: une seule colonne avec uniquement des valeurs négatives et aucune colonne crédit trouvée
    let requiresManualMapping = false;
    
    if (detectedColumns.amountColumns.length === 2) {
      const col1 = detectedColumns.amountColumns[0];
      const col2 = detectedColumns.amountColumns[1];
      
      // Si aucune des deux colonnes n'a de valeurs négatives
      if (!col1.hasNegativeValues && !col2.hasNegativeValues) {
        requiresManualMapping = true;
      }
    } else if (detectedColumns.amountColumns.length === 1) {
      const singleCol = detectedColumns.amountColumns[0];
      // Si une seule colonne avec uniquement des valeurs négatives et type 'split'
      // cela signifie qu'aucune colonne crédit n'a été trouvée automatiquement
      if (singleCol.hasNegativeValues && !singleCol.hasPositiveValues && detectedColumns.amountColumnType === 'split') {
        requiresManualMapping = true;
      }
    }

    if (requiresManualMapping) {
      console.log('[Import] Mapping manuel requis:', {
        raison: detectedColumns.amountColumns.length === 1 
          ? 'Colonne Débit détectée mais aucune colonne Crédit trouvée'
          : 'Deux colonnes de montants sans valeurs négatives détectées'
      });
    } else {
      console.log('[Import] Mapping automatique possible');
    }

    return {
      structure,
      detectedColumns,
      requiresManualMapping,
    };
  }

  /**
   * Valide que les colonnes détectées sont suffisantes pour l'import
   */
  static validateDetection(result: FileAnalysisResult): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!result.detectedColumns.dateColumn) {
      errors.push('Aucune colonne de date détectée');
    }

    if (!result.detectedColumns.libelleColumn) {
      errors.push('Aucune colonne de libellé détectée');
    }

    if (result.detectedColumns.amountColumns.length === 0) {
      errors.push('Aucune colonne de montant détectée');
    }

    if (result.detectedColumns.amountColumns.length > 2) {
      errors.push('Trop de colonnes de montants détectées (maximum 2 attendu)');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Parse une valeur de date depuis différentes chaînes
   */
  static parseDate(value: any): Date | null {
    return parseDateWithMultipleFormats(value);
  }

  /**
   * Parse un nombre depuis une chaîne (gère les formats français)
   */
  static parseNumber(value: any): number {
    if (value === null || value === undefined || value === '') return 0;
    
    const strValue = String(value).trim().replace(/\s/g, '').replace(',', '.');
    const num = parseFloat(strValue);
    return isNaN(num) ? 0 : num;
  }
}

