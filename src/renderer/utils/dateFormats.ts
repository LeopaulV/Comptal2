// Utilitaire centralisé pour la gestion des formats de dates
import { parse, isValid } from 'date-fns';

/**
 * Liste exhaustive des formats de dates supportés
 * Inclut différents séparateurs (/, -, .) et différents ordres (DD/MM/YYYY, YYYY/MM/DD, MM/DD/YYYY)
 */
export const DATE_FORMATS = [
  // Formats avec séparateur /
  'dd/MM/yyyy',
  'yyyy/MM/dd',
  'MM/dd/yyyy',
  'dd/MM/yy',
  'yy/MM/dd',
  'MM/dd/yy',
  // Formats avec séparateur -
  'dd-MM-yyyy',
  'yyyy-MM-dd',
  'MM-dd-yyyy',
  'dd-MM-yy',
  'yy-MM-dd',
  'MM-dd-yy',
  // Formats avec séparateur .
  'dd.MM.yyyy',
  'yyyy.MM.dd',
  'MM.dd.yyyy',
  'dd.MM.yy',
  'yy.MM.dd',
  'MM.dd.yy',
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

  // Si c'est un nombre, essayer de le convertir comme numéro de série Excel
  if (typeof value === 'number') {
    const excelDate = excelSerialToDate(value);
    if (excelDate) {
      return excelDate;
    }
  }

  const strValue = String(value).trim();
  if (!strValue) return null;

  // Si la chaîne ressemble à un nombre pur, essayer de le convertir comme numéro Excel
  const numValue = parseFloat(strValue);
  if (!isNaN(numValue) && strValue === numValue.toString()) {
    const excelDate = excelSerialToDate(numValue);
    if (excelDate) {
      return excelDate;
    }
  }

  // Essayer tous les formats de date textuels
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

