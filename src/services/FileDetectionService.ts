import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ColumnInfo, ColumnType, ExcelSheetInfo, FileStructure, FileType } from '../types/import';
import { parseDateWithMultipleFormats } from '../utils/dateFormats';
import { parseAmount } from '../utils/amounts';
import i18n from '../i18n/config';
import { withLog } from './logger';
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, MAX_IMPORT_SHEETS } from '../utils/security';

const EXCEL_SERIAL_DATE_MIN = 30000;
const EXCEL_SERIAL_DATE_MAX = 50000;

function assertImportFileSize(file: File): void {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error(i18n.t('errors.importFileTooLarge'));
  }
}

function assertRowBudget(rowCount: number): void {
  if (rowCount > MAX_IMPORT_ROWS) {
    throw new Error(i18n.t('errors.importTooManyRows', { max: MAX_IMPORT_ROWS }));
  }
}

function sheetRowCount(worksheet: XLSX.WorkSheet): number {
  const ref = worksheet['!ref'];
  if (!ref) return 0;
  const range = XLSX.utils.decode_range(ref);
  return range.e.r - range.s.r + 1;
}

function sampleSheetRows(worksheet: XLSX.WorkSheet, maxRows: number): unknown[][] {
  const ref = worksheet['!ref'];
  if (!ref) return [];
  const full = XLSX.utils.decode_range(ref);
  const limited = {
    s: full.s,
    e: { c: full.e.c, r: Math.min(full.e.r, full.s.r + maxRows - 1) },
  };
  return XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', range: limited }) as unknown[][];
}

function detectFileType(filename: string): FileType {
  const ext = filename.toLowerCase().split('.').pop();
  return ext === 'xlsx' || ext === 'xls' ? 'excel' : 'csv';
}

function detectColumnType(values: unknown[]): ColumnType {
  const nonEmpty = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (nonEmpty.length === 0) return 'unknown';
  const sampleSize = Math.min(50, nonEmpty.length);
  const dateThreshold = sampleSize < 10 ? 0.4 : 0.6;
  const numericThreshold = sampleSize < 10 ? 0.4 : 0.6;
  const sample = nonEmpty.slice(0, sampleSize);

  let dateCount = 0;
  for (const value of sample) {
    const parsed = parseDateWithMultipleFormats(value);
    if (parsed === null) continue;
    const raw = String(value).trim();
    const normalized = raw.replace(/\s/g, '').replace(',', '.');
    const isStrictNumeric = /^-?\d+(\.\d+)?$/.test(normalized);
    const num =
      typeof value === 'number' ? value : isStrictNumeric ? parseFloat(normalized) : NaN;
    const looksLikeAmount =
      !Number.isNaN(num) && (num < EXCEL_SERIAL_DATE_MIN || num > EXCEL_SERIAL_DATE_MAX);
    if (!looksLikeAmount) dateCount += 1;
  }
  if (sampleSize > 0 && dateCount / sampleSize >= dateThreshold) return 'date';

  let numericCount = 0;
  for (const value of sample) {
    const n = parseAmount(value);
    if (n !== 0 || String(value).trim() === '0') numericCount += 1;
    else {
      const cleaned = String(value).trim().replace(/[\s]/g, '').replace(',', '.');
      if (!Number.isNaN(parseFloat(cleaned)) && Number.isFinite(parseFloat(cleaned))) {
        numericCount += 1;
      }
    }
  }
  if (sampleSize > 0 && numericCount / sampleSize >= numericThreshold) return 'number';
  return 'text';
}

function findDataStartRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(50, rows.length); i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    let hasDate = false;
    let hasText = false;
    let hasNumber = false;
    for (const cell of row.slice(0, 50)) {
      if (cell === null || cell === undefined || cell === '') continue;
      const strValue = String(cell).trim();
      if (!hasDate && parseDateWithMultipleFormats(strValue) !== null) hasDate = true;
      const cleaned = strValue.replace(/[\s]/g, '').replace(',', '.');
      const isNum = !Number.isNaN(parseFloat(cleaned)) && Number.isFinite(parseFloat(cleaned));
      if (!hasNumber && isNum) hasNumber = true;
      if (!hasText && strValue.length > 3 && !isNum) hasText = true;
      if (hasDate && hasText && hasNumber) return i;
    }
  }
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]?.some((cell) => cell !== null && cell !== undefined && cell !== '')) return i;
  }
  return 0;
}

async function parseCsv(file: File, delimiter: string): Promise<unknown[][]> {
  return new Promise((resolve, reject) => {
    Papa.parse<unknown[]>(file, {
      delimiter,
      header: false,
      skipEmptyLines: true,
      preview: MAX_IMPORT_ROWS + 1,
      complete: (results) => {
        const rows = results.data as unknown[][];
        if (rows.length > MAX_IMPORT_ROWS) {
          reject(new Error(i18n.t('errors.importTooManyRows', { max: MAX_IMPORT_ROWS })));
          return;
        }
        resolve(rows);
      },
      error: (error) => reject(error),
    });
  });
}

function readWorkbook(buffer: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(new Uint8Array(buffer), { type: 'array' });
}

export const FileDetectionService = {
  detectFileType,

  async detectCsvDelimiter(file: File): Promise<{ encoding: string; delimiter: string }> {
    const buffer = await file.slice(0, 10000).arrayBuffer();
    const encodings = ['utf-8', 'latin1', 'windows-1252'];
    let content = '';
    let encoding = 'utf-8';
    for (const enc of encodings) {
      try {
        content = new TextDecoder(enc).decode(buffer);
        encoding = enc;
        break;
      } catch {
        continue;
      }
    }
    const firstLine = content.split('\n')[0] ?? '';
    return { encoding, delimiter: firstLine.includes(';') ? ';' : ',' };
  },

  async parseExcelSheet(file: File, sheetName?: string, sheetIndex = 0): Promise<unknown[][]> {
    return withLog('FileDetectionService.parseExcelSheet', async () => {
      assertImportFileSize(file);
      const buffer = await file.arrayBuffer();
      const workbook = readWorkbook(buffer);
      if (workbook.SheetNames.length > MAX_IMPORT_SHEETS) {
        throw new Error(i18n.t('errors.importTooManySheets', { max: MAX_IMPORT_SHEETS }));
      }
      const name = sheetName ?? workbook.SheetNames[sheetIndex];
      const worksheet = workbook.Sheets[name];
      if (!worksheet) {
        throw new Error(i18n.t('errors.sheetNotFound', { name }));
      }
      assertRowBudget(sheetRowCount(worksheet));
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as unknown[][];
      assertRowBudget(rows.length);
      return rows;
    }, { data: { sheetName, file: file.name } });
  },

  async listSheets(file: File): Promise<ExcelSheetInfo[]> {
    return withLog('FileDetectionService.listSheets', async () => {
      assertImportFileSize(file);
      const buffer = await file.arrayBuffer();
      const workbook = readWorkbook(buffer);
      if (workbook.SheetNames.length > MAX_IMPORT_SHEETS) {
        throw new Error(i18n.t('errors.importTooManySheets', { max: MAX_IMPORT_SHEETS }));
      }
      return workbook.SheetNames.map((name, index) => {
        const worksheet = workbook.Sheets[name];
        const rowCount = sheetRowCount(worksheet);
        const sample = sampleSheetRows(worksheet, 50);
        const dates: Date[] = [];
        for (const row of sample) {
          for (const cell of (row ?? []).slice(0, 50)) {
            const parsed = parseDateWithMultipleFormats(cell);
            if (parsed) dates.push(parsed);
          }
        }
        const times = dates.map((d) => d.getTime());
        return {
          name,
          index,
          rowCount,
          startDate: times.length ? format(new Date(Math.min(...times)), 'dd.MM.yyyy') : undefined,
          endDate: times.length ? format(new Date(Math.max(...times)), 'dd.MM.yyyy') : undefined,
        };
      });
    }, { data: { file: file.name } });
  },

  async analyzeFile(file: File, sheetName?: string): Promise<FileStructure> {
    return withLog('FileDetectionService.analyzeFile', async () => {
      assertImportFileSize(file);
      const fileType = detectFileType(file.name);
      let rows: unknown[][];
      let encoding: string | undefined;
      let delimiter: string | undefined;
      if (fileType === 'csv') {
        const csvInfo = await this.detectCsvDelimiter(file);
        encoding = csvInfo.encoding;
        delimiter = csvInfo.delimiter;
        rows = await parseCsv(file, delimiter);
      } else {
        rows = await this.parseExcelSheet(file, sheetName);
      }
      if (rows.length === 0) throw new Error(i18n.t('errors.fileEmpty'));
      assertRowBudget(rows.length);

      const dataStartRowIndex = findDataStartRow(rows);
      const headerRowIndex = dataStartRowIndex > 0 ? dataStartRowIndex - 1 : -1;
      const maxColumns = Math.min(50, Math.max(...rows.map((row) => row.length)));
      const headerRow = headerRowIndex >= 0 ? rows[headerRowIndex] : null;
      const columns: ColumnInfo[] = [];

      for (let colIndex = 0; colIndex < maxColumns; colIndex++) {
        const columnName =
          headerRow && headerRow[colIndex] !== undefined && headerRow[colIndex] !== ''
            ? String(headerRow[colIndex]).trim()
            : `Colonne ${colIndex + 1}`;
        const columnValues: unknown[] = [];
        for (
          let rowIndex = dataStartRowIndex;
          rowIndex < Math.min(dataStartRowIndex + 50, rows.length);
          rowIndex++
        ) {
          if (rows[rowIndex] && rows[rowIndex][colIndex] !== undefined) {
            columnValues.push(rows[rowIndex][colIndex]);
          }
        }
        const columnType = detectColumnType(columnValues);
        const columnInfo: ColumnInfo = {
          index: colIndex,
          name: columnName,
          type: columnType,
          sampleValues: columnValues.slice(0, 5).map((v) => String(v)),
        };
        if (columnType === 'number') {
          let hasNegative = false;
          let hasPositive = false;
          const numbers: number[] = [];
          for (const value of columnValues) {
            const numValue = parseAmount(value);
            if (!Number.isNaN(numValue)) {
              if (numValue < 0) hasNegative = true;
              if (numValue > 0) hasPositive = true;
              numbers.push(numValue);
            }
          }
          columnInfo.hasNegativeValues = hasNegative;
          columnInfo.hasPositiveValues = hasPositive;
          if (numbers.length >= 3) {
            const diffs = numbers.slice(1).map((n, i) => n - numbers[i]);
            columnInfo.isMonotonic = diffs.every((d) => d >= 0) || diffs.every((d) => d <= 0);
          } else {
            columnInfo.isMonotonic = false;
          }
        }
        columns.push(columnInfo);
      }

      return {
        fileType,
        encoding,
        delimiter,
        headerRowIndex,
        dataStartRowIndex,
        columns,
        totalRows: rows.length - dataStartRowIndex,
        sampleRows: rows.slice(dataStartRowIndex, Math.min(dataStartRowIndex + 10, rows.length)),
        rawData: rows,
      };
    }, { data: { file: file.name, sheetName } });
  },
};
