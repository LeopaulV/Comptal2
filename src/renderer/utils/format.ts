// Utilitaires de formatage

import { format as dateFnsFormat } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Formate un montant en euros
 */
export const formatCurrency = (amount: number, currency: string = '€'): string => {
  const formatted = Math.abs(amount).toFixed(2).replace('.', ',');
  const parts = formatted.split(',');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  
  const sign = amount < 0 ? '- ' : '';
  return `${sign}${parts.join(',')} ${currency}`;
};

/**
 * Formate une date
 */
export const formatDate = (date: Date, formatStr: string = 'dd/MM/yyyy'): string => {
  return dateFnsFormat(date, formatStr, { locale: fr });
};

/**
 * Formate un pourcentage
 */
export const formatPercent = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)} %`;
};

/**
 * Raccourcit un texte
 */
export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Formate un nombre avec séparateur de milliers
 */
export const formatNumber = (value: number, decimals: number = 0): string => {
  return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

