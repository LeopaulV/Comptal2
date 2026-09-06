import { Adresse, Client, EMPTY_ADRESSE } from '../types/invoice';
import type { Donateur as AssoDonateur } from '../types/association';

export function newEntityId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatMoney(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} €`;
}

/** Durée décimale (heures) → `hh:mm` (autorise plus de 24 h). */
export function hoursToHhMm(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) return '00:00';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Saisie `hh:mm` (ou décimal) → heures. */
export function hhMmToHours(value: string): number {
  const trimmed = value.trim().replace(',', '.');
  const match = trimmed.match(/^(\d{1,4}):([0-5]?\d)$/);
  if (match) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
    return hours + minutes / 60;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function formatDateFr(value: Date | string | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR');
}

export function toIsoDateInput(value: Date | string | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function parseDateOrNow(value: unknown): Date {
  if (!value) return new Date();
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function reviveAdresse(raw?: Partial<Adresse> | null): Adresse {
  return {
    rue: raw?.rue ?? '',
    codePostal: raw?.codePostal ?? '',
    ville: raw?.ville ?? '',
    pays: raw?.pays ?? EMPTY_ADRESSE.pays,
  };
}

export function clientDisplayName(client: Pick<Client, 'type' | 'denominationSociale' | 'prenom' | 'nom'>): string {
  if (client.type === 'entreprise') {
    return client.denominationSociale?.trim() || [client.prenom, client.nom].filter(Boolean).join(' ') || 'Client';
  }
  return [client.prenom, client.nom].filter(Boolean).join(' ') || client.denominationSociale?.trim() || 'Client';
}

export function donateurDisplayName(
  donateur: Pick<AssoDonateur, 'denominationSociale' | 'prenom' | 'nom'>
): string {
  return (
    donateur.denominationSociale?.trim() ||
    [donateur.prenom, donateur.nom].filter(Boolean).join(' ').trim() ||
    'Donateur'
  );
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function isDevisCaduc(devis: { caduc?: boolean; statut?: string }): boolean {
  return Boolean(devis.caduc || devis.statut === 'caduc');
}

/** Normalise un libellé ou un numéro pour comparer (casse, accents, espaces, ponctuation). */
export function normalizeInvoiceToken(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Le libellé bancaire contient-il le numéro de facture / devis ? */
export function labelContainsDocumentNumero(label: string, numero: string): boolean {
  const nLabel = normalizeInvoiceToken(label);
  const nNum = normalizeInvoiceToken(numero);
  if (!nLabel || !nNum || nNum.length < 4) return false;
  return nLabel.includes(nNum);
}
