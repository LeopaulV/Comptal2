// Service pour gérer les feuilles Excel

import * as XLSX from 'xlsx';
import { ExcelSheetInfo } from '../types/ExcelImport';
import { format } from 'date-fns';
import { parseDateWithMultipleFormats } from '../utils/dateFormats';

export class ExcelSheetService {
  /**
   * Liste toutes les feuilles d'un fichier Excel
   */
  static async listSheets(file: File): Promise<ExcelSheetInfo[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          const sheets: ExcelSheetInfo[] = workbook.SheetNames.map((name, index) => {
            const worksheet = workbook.Sheets[name];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
            
            // Essayer de détecter les dates dans la feuille
            const dates = this.detectDatesInSheet(jsonData);
            
            return {
              name,
              index,
              rowCount: jsonData.length,
              startDate: dates.min ? format(dates.min, 'dd.MM.yyyy') : undefined,
              endDate: dates.max ? format(dates.max, 'dd.MM.yyyy') : undefined,
            };
          });
          
          console.log('[Import] Feuilles Excel listées:', {
            nombre: sheets.length,
            feuilles: sheets.map(s => ({
              nom: s.name,
              lignes: s.rowCount,
              periode: s.startDate && s.endDate ? `${s.startDate} - ${s.endDate}` : 'N/A'
            }))
          });
          
          resolve(sheets);
        } catch (error: any) {
          reject(new Error(`Erreur lors de la lecture du fichier Excel: ${error.message}`));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Erreur lors de la lecture du fichier'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Parse une feuille Excel spécifique et retourne les données brutes
   */
  static async parseSheet(file: File, sheetName: string): Promise<any[][]> {
    console.log('[Import] ExcelSheetService.parseSheet début:', {
      fichier: file.name,
      feuille: sheetName,
      taille: `${(file.size / 1024).toFixed(2)} KB`
    });

    return new Promise((resolve, reject) => {
      // Timeout de 30 secondes pour éviter un blocage infini
      const timeoutId = setTimeout(() => {
        console.error('[Import] Timeout lors de la lecture de la feuille Excel:', sheetName);
        reject(new Error(`Timeout: La lecture de la feuille "${sheetName}" a pris plus de 30 secondes`));
      }, 30000);

      // Vérifier que le fichier est valide
      if (!file || file.size === 0) {
        clearTimeout(timeoutId);
        reject(new Error('Fichier invalide ou vide'));
        return;
      }

      const reader = new FileReader();
      
      reader.onload = (e) => {
        clearTimeout(timeoutId);
        try {
          console.log('[Import] ExcelSheetService FileReader onload déclenché');
          
          if (!e.target || !e.target.result) {
            throw new Error('Aucune donnée retournée par FileReader');
          }

          const data = new Uint8Array(e.target.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[sheetName];
          
          if (!worksheet) {
            reject(new Error(`Feuille "${sheetName}" non trouvée. Feuilles disponibles: ${workbook.SheetNames.join(', ')}`));
            return;
          }
          
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          console.log('[Import] ExcelSheetService parseSheet terminé:', {
            feuille: sheetName,
            lignes: (jsonData as any[][]).length
          });
          resolve(jsonData as any[][]);
        } catch (error: any) {
          console.error('[Import] ExcelSheetService erreur dans onload:', error);
          reject(new Error(`Erreur lors de la lecture de la feuille "${sheetName}": ${error.message}`));
        }
      };
      
      reader.onerror = (error) => {
        clearTimeout(timeoutId);
        console.error('[Import] ExcelSheetService FileReader onerror:', error);
        const errorMsg = reader.error 
          ? `Erreur FileReader: ${reader.error.message || 'Erreur inconnue'}`
          : 'Erreur lors de la lecture du fichier';
        reject(new Error(errorMsg));
      };

      reader.onabort = () => {
        clearTimeout(timeoutId);
        console.error('[Import] ExcelSheetService FileReader onabort');
        reject(new Error('Lecture du fichier annulée'));
      };

      console.log('[Import] ExcelSheetService début readAsArrayBuffer...');
      try {
        reader.readAsArrayBuffer(file);
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('[Import] ExcelSheetService erreur démarrage FileReader:', error);
        reject(new Error(`Impossible de démarrer la lecture du fichier: ${error.message}`));
      }
    });
  }

  /**
   * Détecte les dates dans une feuille Excel
   */
  private static detectDatesInSheet(data: any[][]): { min?: Date; max?: Date } {
    const dates: Date[] = [];

    // Parcourir les premières lignes (limité à 50 lignes pour la cohérence)
    for (let rowIndex = 0; rowIndex < Math.min(50, data.length); rowIndex++) {
      const row = data[rowIndex];
      if (!row) continue;

      // Limiter aussi aux 50 premières colonnes
      const limitedRow = row.slice(0, 50);

      for (const cell of limitedRow) {
        if (!cell || cell === '') continue;

        // Essayer de parser comme date avec tous les formats supportés
        const parsed = parseDateWithMultipleFormats(cell);
        if (parsed !== null) {
          dates.push(parsed);
        }
      }
    }

    if (dates.length === 0) {
      return {};
    }

    return {
      min: new Date(Math.min(...dates.map(d => d.getTime()))),
      max: new Date(Math.max(...dates.map(d => d.getTime()))),
    };
  }
}

