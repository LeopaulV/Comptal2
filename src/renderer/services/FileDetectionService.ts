// Service pour détecter la structure des fichiers CSV/Excel

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { FileType, FileStructure, ColumnType, ColumnInfo } from '../types/FileAnalysis';
import { parseDateWithMultipleFormats } from '../utils/dateFormats';

export class FileDetectionService {
  /**
   * Détecte le type de fichier à partir de son extension
   */
  static detectFileType(filename: string): FileType {
    const ext = filename.toLowerCase().split('.').pop();
    const fileType = ext === 'xlsx' || ext === 'xls' ? 'excel' : 'csv';
    console.log('[Import] Type de fichier détecté:', { nom: filename, type: fileType, extension: ext });
    return fileType;
  }

  /**
   * Détecte l'encodage et le délimiteur d'un fichier CSV
   */
  static async detectCSVEncodingAndDelimiter(file: File): Promise<{ encoding: string; delimiter: string }> {
    // Lire les premiers octets pour détecter l'encodage
    const buffer = await file.slice(0, 10000).arrayBuffer();
    const textDecoder = new TextDecoder('utf-8');
    let content = textDecoder.decode(buffer);
    
    // Essayer différents encodages
    const encodings = ['utf-8', 'latin1', 'windows-1252'];
    let encoding = 'utf-8';
    
    for (const enc of encodings) {
      try {
        const decoder = new TextDecoder(enc);
        content = decoder.decode(buffer);
        encoding = enc;
        break;
      } catch {
        continue;
      }
    }

    // Détecter le délimiteur
    const firstLine = content.split('\n')[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';
    
    return { encoding, delimiter };
  }

  /**
   * Parse un fichier CSV et retourne les données brutes
   */
  static async parseCSV(file: File, delimiter: string = ';'): Promise<any[][]> {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        delimiter,
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as any[][];
          console.log('[Import] CSV parsé:', { lignes: rows.length, delimitateur: delimiter });
          resolve(rows);
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  }

  /**
   * Parse un fichier Excel et retourne les données brutes
   */
  static async parseExcel(file: File, sheetIndex: number = 0, sheetName?: string): Promise<any[][]> {
    console.log('[Import] Début parseExcel:', {
      nomFichier: file.name,
      taille: `${(file.size / 1024).toFixed(2)} KB`,
      feuille: sheetName || `index ${sheetIndex}`
    });

    return new Promise((resolve, reject) => {
      // Timeout de 30 secondes pour éviter un blocage infini
      const timeoutId = setTimeout(() => {
        console.error('[Import] Timeout lors de la lecture du fichier Excel:', file.name);
        reject(new Error(`Timeout: La lecture du fichier Excel a pris plus de 30 secondes`));
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
          console.log('[Import] FileReader onload déclenché, traitement des données...');
          
          if (!e.target || !e.target.result) {
            throw new Error('Aucune donnée retournée par FileReader');
          }

          const data = new Uint8Array(e.target.result as ArrayBuffer);
          console.log('[Import] Données lues:', `${(data.length / 1024).toFixed(2)} KB`);
          
          const workbook = XLSX.read(data, { type: 'array' });
          console.log('[Import] Workbook chargé, feuilles disponibles:', workbook.SheetNames);
          
          let targetSheetName: string;
          if (sheetName) {
            targetSheetName = sheetName;
          } else {
            targetSheetName = workbook.SheetNames[sheetIndex];
          }
          
          const worksheet = workbook.Sheets[targetSheetName];
          if (!worksheet) {
            reject(new Error(`Feuille "${targetSheetName}" non trouvée. Feuilles disponibles: ${workbook.SheetNames.join(', ')}`));
            return;
          }
          
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          console.log('[Import] Feuille Excel parsée:', { 
            feuille: targetSheetName, 
            lignes: (jsonData as any[][]).length 
          });
          resolve(jsonData as any[][]);
        } catch (error: any) {
          console.error('[Import] Erreur dans onload:', error);
          reject(new Error(`Erreur lors du traitement des données Excel: ${error.message}`));
        }
      };
      
      reader.onerror = (error) => {
        clearTimeout(timeoutId);
        console.error('[Import] FileReader onerror déclenché:', error);
        const errorMsg = reader.error 
          ? `Erreur FileReader: ${reader.error.message || 'Erreur inconnue'}`
          : 'Erreur lors de la lecture du fichier Excel';
        reject(new Error(errorMsg));
      };

      reader.onabort = () => {
        clearTimeout(timeoutId);
        console.error('[Import] FileReader onabort déclenché');
        reject(new Error('Lecture du fichier annulée'));
      };

      console.log('[Import] Début FileReader.readAsArrayBuffer...');
      try {
        reader.readAsArrayBuffer(file);
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('[Import] Erreur lors du démarrage de FileReader:', error);
        reject(new Error(`Impossible de démarrer la lecture du fichier: ${error.message}`));
      }
    });
  }

  /**
   * Détecte le type d'une colonne à partir de ses valeurs
   */
  static detectColumnType(values: any[], columnIndex: number): ColumnType {
    if (values.length === 0) return 'unknown';

    const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '');
    if (nonEmptyValues.length === 0) return 'unknown';

    // Tester si c'est une colonne de dates
    let dateCount = 0;
    const sampleSize = Math.min(50, nonEmptyValues.length);
    
    // Ajuster le seuil selon le nombre de données disponibles
    // Avec peu de données (< 10), être plus tolérant (40% au lieu de 60%)
    const dateThreshold = sampleSize < 10 ? 0.4 : 0.6;

    for (const value of nonEmptyValues.slice(0, sampleSize)) {
      const parsed = parseDateWithMultipleFormats(value);
      if (parsed !== null) {
        dateCount++;
      }
    }

    // Si au moins X% des valeurs sont des dates valides
    if (sampleSize > 0 && dateCount / sampleSize >= dateThreshold) {
      console.log(`[Import] Colonne ${columnIndex} détectée comme date: ${dateCount}/${sampleSize} valeurs (seuil: ${(dateThreshold * 100).toFixed(0)}%)`);
      return 'date';
    }

    // Tester si c'est une colonne numérique
    let numericCount = 0;
    for (const value of nonEmptyValues.slice(0, sampleSize)) {
      const strValue = String(value).trim().replace(/[\s,]/g, '').replace(',', '.');
      if (!isNaN(parseFloat(strValue)) && isFinite(parseFloat(strValue))) {
        numericCount++;
      }
    }

    // Ajuster le seuil pour les nombres aussi
    const numericThreshold = sampleSize < 10 ? 0.4 : 0.6;

    // Si au moins X% des valeurs sont numériques
    if (sampleSize > 0 && numericCount / sampleSize >= numericThreshold) {
      console.log(`[Import] Colonne ${columnIndex} détectée comme numérique: ${numericCount}/${sampleSize} valeurs (seuil: ${(numericThreshold * 100).toFixed(0)}%)`);
      return 'number';
    }

    // Sinon, c'est du texte
    console.log(`[Import] Colonne ${columnIndex} détectée comme texte (dates: ${dateCount}/${sampleSize}, numériques: ${numericCount}/${sampleSize})`);
    return 'text';
  }

  /**
   * Trouve la première ligne de données réelle (ignore les en-têtes)
   */
  static findDataStartRow(rows: any[][]): number {
    if (rows.length === 0) return 0;

    // Parcourir les premières lignes pour trouver la première avec des données valides
    for (let i = 0; i < Math.min(50, rows.length); i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      // Limiter la recherche aux 50 premières colonnes
      const limitedRow = row.slice(0, 50);

      // Vérifier si cette ligne contient au minimum: une date, un texte, et un nombre
      let hasDate = false;
      let hasText = false;
      let hasNumber = false;

      for (const cell of limitedRow) {
        if (!cell || cell === '') continue;

        const strValue = String(cell).trim();
        
        // Tester date
        if (!hasDate) {
          const parsed = parseDateWithMultipleFormats(strValue);
          if (parsed !== null) {
            hasDate = true;
          }
        }

        // Tester nombre
        if (!hasNumber) {
          const cleaned = strValue.replace(/[\s,]/g, '').replace(',', '.');
          if (!isNaN(parseFloat(cleaned)) && isFinite(parseFloat(cleaned))) {
            hasNumber = true;
          }
        }

        // Tester texte (longueur > 3 caractères et non numérique)
        if (!hasText && strValue.length > 3) {
          const cleaned = strValue.replace(/[\s,]/g, '').replace(',', '.');
          if (isNaN(parseFloat(cleaned)) || !isFinite(parseFloat(cleaned))) {
            hasText = true;
          }
        }

        if (hasDate && hasText && hasNumber) {
          return i;
        }
      }
    }

    // Si aucune ligne ne correspond, retourner la première ligne non vide
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i].length > 0 && rows[i].some(cell => cell !== null && cell !== undefined && cell !== '')) {
        return i;
      }
    }

    return 0;
  }

  /**
   * Analyse la structure d'un fichier
   */
  static async analyzeFile(file: File, sheetName?: string): Promise<FileStructure> {
    console.log('[Import] Début analyse structure fichier:', { 
      nom: file.name, 
      feuille: sheetName || 'N/A' 
    });
    
    const fileType = this.detectFileType(file.name);
    let rows: any[][];
    let encoding: string | undefined;
    let delimiter: string | undefined;

    if (fileType === 'csv') {
      const csvInfo = await this.detectCSVEncodingAndDelimiter(file);
      encoding = csvInfo.encoding;
      delimiter = csvInfo.delimiter;
      rows = await this.parseCSV(file, delimiter);
    } else {
      // Pour Excel, si sheetName est fourni, utiliser cette feuille spécifique
      rows = await this.parseExcel(file, 0, sheetName);
    }

    if (rows.length === 0) {
      throw new Error('Le fichier est vide');
    }

    // Trouver la première ligne de données réelle
    const dataStartRowIndex = this.findDataStartRow(rows);
    const headerRowIndex = dataStartRowIndex > 0 ? dataStartRowIndex - 1 : -1;

    // Extraire les colonnes (limiter à 50 colonnes pour la recherche)
    const maxColumns = Math.min(50, Math.max(...rows.map(row => row.length)));
    const columns: ColumnInfo[] = [];

    // Prendre les noms de colonnes depuis la ligne d'en-tête si elle existe
    const headerRow = headerRowIndex >= 0 ? rows[headerRowIndex] : null;

    for (let colIndex = 0; colIndex < maxColumns; colIndex++) {
      const columnName = headerRow && headerRow[colIndex] 
        ? String(headerRow[colIndex]).trim() 
        : `Colonne ${colIndex + 1}`;

      // Extraire les valeurs de cette colonne depuis les lignes de données (limiter aux 50 premières lignes)
      const columnValues: any[] = [];
      for (let rowIndex = dataStartRowIndex; rowIndex < Math.min(dataStartRowIndex + 50, rows.length); rowIndex++) {
        if (rows[rowIndex] && rows[rowIndex][colIndex] !== undefined) {
          columnValues.push(rows[rowIndex][colIndex]);
        }
      }

      const columnType = this.detectColumnType(columnValues, colIndex);
      const sampleValues = columnValues.slice(0, 5).map(v => String(v));

      const columnInfo: ColumnInfo = {
        index: colIndex,
        name: columnName,
        type: columnType,
        sampleValues,
      };

      // Pour les colonnes numériques, analyser les signes
      if (columnType === 'number') {
        let hasNegative = false;
        let hasPositive = false;
        for (const value of columnValues) {
          const numValue = this.parseNumber(String(value));
          if (!isNaN(numValue)) {
            if (numValue < 0) hasNegative = true;
            if (numValue > 0) hasPositive = true;
          }
        }
        columnInfo.hasNegativeValues = hasNegative;
        columnInfo.hasPositiveValues = hasPositive;

        // Détecter si c'est monotone (solde)
        // Avec peu de données (< 5 lignes), être plus strict : nécessiter au moins 3 valeurs et une progression claire
        if (columnValues.length > 1) {
          const numbers = columnValues
            .map(v => this.parseNumber(String(v)))
            .filter(n => !isNaN(n));
          
          if (numbers.length >= 2) {
            const diffs = numbers.slice(1).map((n, i) => n - numbers[i]);
            const allPositive = diffs.every(d => d >= 0);
            const allNegative = diffs.every(d => d <= 0);
            
            // Avec peu de données, être plus strict : nécessiter au moins 3 valeurs pour considérer comme monotone
            // Sinon, on risque de classer des colonnes de montant comme solde
            if (numbers.length >= 3) {
              columnInfo.isMonotonic = allPositive || allNegative;
              if (columnInfo.isMonotonic) {
                console.log(`[Import] Colonne ${colIndex} (${columnName}) détectée comme monotone (solde probable): ${numbers.length} valeurs`);
              }
            } else {
              // Avec moins de 3 valeurs, ne pas considérer comme monotone pour éviter les faux positifs
              columnInfo.isMonotonic = false;
              console.log(`[Import] Colonne ${colIndex} (${columnName}) non considérée comme monotone: seulement ${numbers.length} valeurs (minimum 3 requis)`);
            }
          }
        }
      }

      columns.push(columnInfo);
    }

    // Extraire quelques lignes d'exemple pour prévisualisation
    const sampleRows = rows.slice(dataStartRowIndex, Math.min(dataStartRowIndex + 10, rows.length));

    const structure = {
      fileType,
      encoding,
      delimiter,
      headerRowIndex,
      dataStartRowIndex,
      columns,
      totalRows: rows.length - dataStartRowIndex,
      sampleRows,
      rawData: rows, // Stocker les données parsées pour éviter la relecture
    };

    console.log('[Import] Structure analysée:', {
      type: fileType,
      colonnes: columns.length,
      lignesTotal: rows.length,
      lignesDonnees: structure.totalRows,
      ligneDebut: dataStartRowIndex,
      encodage: encoding,
      delimitateur: delimiter,
      donneesCachees: rows.length > 0
    });

    return structure;
  }

  /**
   * Parse un nombre depuis une chaîne (gère les formats français)
   */
  private static parseNumber(value: string): number {
    const cleaned = value.trim().replace(/\s/g, '').replace(',', '.');
    return parseFloat(cleaned);
  }
}

