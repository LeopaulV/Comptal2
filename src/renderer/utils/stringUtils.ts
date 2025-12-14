// Utilitaires pour la manipulation et comparaison de chaînes

/**
 * Normalise un libellé pour la comparaison :
 * - Convertit en minuscules
 * - Supprime les espaces multiples
 * - Supprime les dates (format DD/MM, DD-MM, etc.)
 * - Supprime les chiffres à la fin (ex: "NETFLIX 12/11" -> "netflix")
 */
export function normalizeLabel(label: string): string {
  if (!label) return '';
  
  let normalized = label.toLowerCase().trim();
  
  // Supprimer les espaces multiples
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Supprimer les dates au format DD/MM, DD-MM, DD.MM, DD MM
  normalized = normalized.replace(/\d{1,2}[\/\-\.\s]\d{1,2}/g, '');
  
  // Supprimer les dates au format YYYY-MM-DD, YYYY/MM/DD
  normalized = normalized.replace(/\d{4}[\/\-]\d{2}[\/\-]\d{2}/g, '');
  
  // Supprimer les chiffres isolés à la fin (ex: "NETFLIX 12" -> "netflix")
  normalized = normalized.replace(/\s+\d+$/, '');
  
  // Supprimer les caractères spéciaux répétitifs
  normalized = normalized.replace(/[^\w\s]/g, ' ');
  
  // Nettoyer à nouveau les espaces multiples
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Calcule la similarité entre deux chaînes normalisées en utilisant la distance de Levenshtein
 * Retourne un score entre 0 (complètement différent) et 1 (identique)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeLabel(str1);
  const s2 = normalizeLabel(str2);
  
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;
  
  // Distance de Levenshtein
  const matrix: number[][] = [];
  
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  const distance = matrix[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  
  // Score de similarité : 1 - (distance / maxLength)
  return 1 - (distance / maxLength);
}

/**
 * Vérifie si deux libellés sont similaires (seuil de 70%)
 */
export function areLabelsSimilar(label1: string, label2: string, threshold: number = 0.7): boolean {
  return calculateSimilarity(label1, label2) >= threshold;
}

/**
 * Extrait les mots-clés principaux d'un libellé (pour regroupement amélioré)
 */
export function extractKeywords(label: string): string[] {
  const normalized = normalizeLabel(label);
  // Supprimer les mots trop courts (< 3 caractères) et les mots communs
  const commonWords = ['le', 'la', 'les', 'de', 'du', 'des', 'et', 'ou', 'pour', 'avec', 'sur', 'par'];
  const words = normalized.split(/\s+/).filter(
    word => word.length >= 3 && !commonWords.includes(word)
  );
  return words;
}

