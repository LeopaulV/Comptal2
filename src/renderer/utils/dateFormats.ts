// Utilitaire centralisé pour la gestion des formats de dates
import { parse, isValid, parseISO } from 'date-fns';

/** Seuil minimal (série Excel) pour éviter d'interpréter des montants (ex. 1234,56) comme des dates — aligné sur FileDetectionService */
const EXCEL_SERIAL_STRING_MIN = 30000;

/**
 * Liste exhaustive des formats de dates supportés
 * Inclut différents séparateurs (/, -, .) et différents ordres (DD/MM/YYYY, YYYY/MM/DD, MM/DD/YYYY)
 */
export const DATE_FORMATS = [
  // Formats avec séparateur /
  'dd/MM/yyyy',
  'd/M/yyyy',
  'yyyy/MM/dd',
  'yyyy/M/d',
  'MM/dd/yyyy',
  'M/d/yyyy',
  'dd/MM/yy',
  'd/M/yy',
  'yy/MM/dd',
  'MM/dd/yy',
  'M/d/yy',
  // Formats avec séparateur -
  'dd-MM-yyyy',
  'd-M-yyyy',
  'yyyy-MM-dd',
  'yyyy-M-d',
  'MM-dd-yyyy',
  'M-d-yyyy',
  'dd-MM-yy',
  'd-M-yy',
  'yy-MM-dd',
  'MM-dd-yy',
  'M-d-yy',
  // Formats avec séparateur .
  'dd.MM.yyyy',
  'd.M.yyyy',
  'yyyy.MM.dd',
  'yyyy.M.d',
  'MM.dd.yyyy',
  'M.d.yyyy',
  'dd.MM.yy',
  'd.M.yy',
  'yy.MM.dd',
  'MM.dd.yy',
  'M.d.yy',
  // Formats sans séparateur
  'ddMMyyyy',
  'yyyyMMdd',
  'MMddyyyy',
  'ddMMyy',
  'yyMMdd',
  'MMddyy',
] as const;

/**
 * Convertit un numéro de série Excel en date JavaScript
 * Excel stocke les dates comme le nombre de jours depuis le 1er janvier 1900
 * @param serial - Le numéro de série Excel
 * @returns La date convertie ou null si invalide
 */
function excelSerialToDate(serial: number): Date | null {
  // Vérifier si c'est un numéro de série Excel valide (entre 1 et 100000 pour dates 1900-2173)
  if (serial < 1 || serial > 100000) return null;
  
  // Excel considère 1900 comme une année bissextile (bug historique)
  // et compte depuis le 1er janvier 1900
  // Formule : Date Unix = (serial - 25569) * 86400 * 1000
  // 25569 = nombre de jours entre 1900-01-01 et 1970-01-01 (epoch Unix)
  const unixTimestamp = (serial - 25569) * 86400 * 1000;
  const date = new Date(unixTimestamp);
  
  if (isValid(date) && !isNaN(date.getTime())) {
    return date;
  }
  
  return null;
}

/**
 * Nettoie les caractères invisibles (BOM, espaces insécables) souvent présents dans les CSV / exports bancaires.
 */
function normalizeDateStringInput(raw: string): string {
  let s = raw.trim();
  if (s.charCodeAt(0) === 0xfeff) {
    s = s.slice(1).trim();
  }
  s = s.replace(/[\u00A0\u202F\u2007]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Retire l'heure pour les chaînes type "DD/MM/YYYY HH:mm:ss", "YYYY-MM-DDTHH:mm", etc.
 * Les formats date-only de date-fns échouent si la chaîne contient encore l'heure.
 */
function extractDatePartForParsing(s: string): string {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    return t.slice(0, 10);
  }
  const ymdSep = t.match(/^(\d{4}[./-]\d{1,2}[./-]\d{1,2})(?:\s|[Tt]|$)/);
  if (ymdSep) {
    return ymdSep[1];
  }
  const dmy = t.match(/^(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})(?:\s|$)/);
  if (dmy) {
    return dmy[1];
  }
  return t;
}

/**
 * Chaîne uniquement numérique (série Excel ou fraction de jour), ex. "45231", "45231.0", "45231.41667".
 */
function tryParseExcelSerialFromNumericString(strValue: string): Date | null {
  const cleaned = strValue.replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }
  const num = parseFloat(cleaned);
  if (isNaN(num)) {
    return null;
  }
  // Même plage que excelSerialToDate ; seuil bas pour les chaînes = éviter les montants type 1234.56
  if (num >= EXCEL_SERIAL_STRING_MIN && num <= 100000) {
    return excelSerialToDate(num);
  }
  return null;
}

/**
 * Parse une date en essayant tous les formats supportés
 * @param value - La valeur à parser (peut être une string, un Date, ou un nombre)
 * @returns La date parsée ou null si aucun format ne correspond
 */
export function parseDateWithMultipleFormats(value: any): Date | null {
  if (!value) return null;

  // Si c'est déjà un objet Date valide
  if (value instanceof Date && isValid(value)) {
    return value;
  }

  // Si c'est un nombre, essayer de le convertir comme numéro de série Excel (feuilles Excel / export)
  if (typeof value === 'number') {
    const excelDate = excelSerialToDate(value);
    if (excelDate) {
      return excelDate;
    }
  }

  let strValue = normalizeDateStringInput(String(value));
  if (!strValue) return null;

  // CSV : numéro de série Excel en texte (y compris "45231.0")
  const excelFromString = tryParseExcelSerialFromNumericString(strValue);
  if (excelFromString) {
    return excelFromString;
  }

  // ISO 8601 (date ou datetime) — souvent dans les exports
  if (/^\d{4}-\d{2}-\d{2}/.test(strValue)) {
    try {
      const isoParsed = parseISO(strValue);
      if (isValid(isoParsed)) {
        return isoParsed;
      }
    } catch {
      // Ignorer
    }
  }

  const dateText = extractDatePartForParsing(strValue);

  // Essayer tous les formats de date textuels (sur la partie date sans heure si besoin)
  for (const fmt of DATE_FORMATS) {
    try {
      const parsed = parse(dateText, fmt, new Date());
      if (isValid(parsed)) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  // Chaîne complète (formats avec heure intégrés si ajoutés plus tard)
  if (dateText !== strValue) {
    for (const fmt of DATE_FORMATS) {
      try {
        const parsed = parse(strValue, fmt, new Date());
        if (isValid(parsed)) {
          return parsed;
        }
      } catch {
        continue;
      }
    }
  }

  // Essayer de parser comme Date native (dernier recours)
  try {
    const date = new Date(strValue);
    if (isValid(date) && !isNaN(date.getTime())) {
      return date;
    }
  } catch {
    // Ignorer
  }

  return null;
}

/**
 * Vérifie si une valeur est une date valide selon les formats supportés
 * @param value - La valeur à vérifier
 * @returns true si la valeur est une date valide
 */
export function isValidDate(value: any): boolean {
  return parseDateWithMultipleFormats(value) !== null;
}

