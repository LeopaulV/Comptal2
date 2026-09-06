import { format, isValid, parse, parseISO } from 'date-fns';

const EXCEL_SERIAL_MIN = 30000;
const EXCEL_SERIAL_MAX = 100000;

const DATE_FORMATS = [
  'dd/MM/yyyy',
  'd/M/yyyy',
  'yyyy/MM/dd',
  'MM/dd/yyyy',
  'dd/MM/yy',
  'd/M/yy',
  'dd-MM-yyyy',
  'd-M-yyyy',
  'yyyy-MM-dd',
  'MM-dd-yyyy',
  'dd.MM.yyyy',
  'd.M.yyyy',
  'yyyy.MM.dd',
  'ddMMyyyy',
  'yyyyMMdd',
] as const;

function excelSerialToDate(serial: number): Date | null {
  if (serial < 1 || serial > EXCEL_SERIAL_MAX) return null;
  const date = new Date((serial - 25569) * 86400 * 1000);
  return isValid(date) ? date : null;
}

function normalize(raw: string): string {
  let s = raw.trim();
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1).trim();
  return s.replace(/[\u00A0\u202F\u2007]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractDatePart(s: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const ymd = s.match(/^(\d{4}[./-]\d{1,2}[./-]\d{1,2})(?:\s|[Tt]|$)/);
  if (ymd) return ymd[1];
  const dmy = s.match(/^(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})(?:\s|$)/);
  if (dmy) return dmy[1];
  return s;
}

/** Parse une date bancaire (CSV, Excel série, ISO, dd/MM/yyyy…). */
export function parseDateWithMultipleFormats(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && isValid(value)) return value;
  if (typeof value === 'number') return excelSerialToDate(value);

  const strValue = normalize(String(value));
  if (!strValue) return null;

  const cleaned = strValue.replace(/\s/g, '').replace(',', '.');
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
    const num = parseFloat(cleaned);
    if (num >= EXCEL_SERIAL_MIN && num <= EXCEL_SERIAL_MAX) {
      const fromSerial = excelSerialToDate(num);
      if (fromSerial) return fromSerial;
    }
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(strValue)) {
    const iso = parseISO(strValue);
    if (isValid(iso)) return iso;
  }

  const dateText = extractDatePart(strValue);
  for (const fmt of DATE_FORMATS) {
    const parsed = parse(dateText, fmt, new Date());
    if (isValid(parsed)) return parsed;
  }

  const native = new Date(strValue);
  return isValid(native) ? native : null;
}

export function toIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function formatFrDate(iso: string): string {
  const parsed = parseISO(iso);
  return isValid(parsed) ? format(parsed, 'dd/MM/yyyy') : iso;
}
