const UNITES = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
];
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

function moinsDeCent(n: number): string {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (d === 7) return `soixante-${UNITES[10 + u]}`;
  if (d === 8) return u === 0 ? 'quatre-vingts' : `quatre-vingt-${UNITES[u]}`;
  if (d === 9) return `quatre-vingt-${UNITES[10 + u]}`;
  if (u === 0) return DIZAINES[d];
  if (u === 1) return `${DIZAINES[d]}-et-un`;
  return `${DIZAINES[d]}-${UNITES[u]}`;
}

function moinsDeMille(n: number): string {
  if (n < 100) return moinsDeCent(n);
  const c = Math.floor(n / 100);
  const r = n % 100;
  const centStr = c === 1 ? 'cent' : `${UNITES[c]} cent${r === 0 && c > 1 ? 's' : ''}`;
  return r === 0 ? centStr : `${centStr} ${moinsDeCent(r)}`;
}

function partieEntiere(n: number): string {
  if (n === 0) return 'zéro';
  if (n < 1000) return moinsDeMille(n);
  const milliers = Math.floor(n / 1000);
  const reste = n % 1000;
  const milliersStr = milliers === 1 ? 'mille' : `${moinsDeMille(milliers)} mille`;
  return reste === 0 ? milliersStr : `${milliersStr} ${moinsDeMille(reste)}`;
}

/** Convertit un montant en euros vers une mention en lettres (reçu fiscal). */
export function montantEnLettres(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  let entier = Math.floor(safe);
  let centimes = Math.round((safe - entier) * 100);
  if (centimes === 100) {
    entier += 1;
    centimes = 0;
  }

  if (entier === 0 && centimes === 0) return 'zéro euro';

  let result = '';
  if (entier >= 1_000_000) {
    const millions = Math.floor(entier / 1_000_000);
    const reste = entier % 1_000_000;
    result += `${moinsDeMille(millions)}${millions > 1 ? ' millions' : ' million'}`;
    if (reste > 0) result += ` ${partieEntiere(reste)}`;
  } else {
    result = partieEntiere(entier);
  }

  result += entier > 1 ? ' euros' : ' euro';
  if (centimes > 0) {
    result += ` et ${moinsDeCent(centimes)}${centimes > 1 ? ' centimes' : ' centime'}`;
  }
  return result.charAt(0).toUpperCase() + result.slice(1);
}
