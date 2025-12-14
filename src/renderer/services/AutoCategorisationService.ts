// Service pour l'auto-catégorisation basée sur des statistiques par mot

import { WordStats, WordStatsMap, CategorySuggestion } from '../types/AutoCategorisation';

// Constantes de configuration
const MIN_WORD_LENGTH = 2;
const SHORT_WORD_FACTOR = 0.95; // Facteur appliqué aux mots de moins de 4 caractères
const SHORT_WORD_THRESHOLD = 4; // Longueur minimale pour ne pas appliquer le facteur
const MIN_SUGGESTION_SCORE = 0.1; // Score minimum pour proposer une catégorie

export class AutoCategorisationService {
  /**
   * Tokenise un libellé en mots uniques
   * Sépare sur espace, "-" et "_"
   * Garde uniquement les mots avec longueur >= MIN_WORD_LENGTH
   */
  static tokenizeLabel(label: string): string[] {
    if (!label || typeof label !== 'string') {
      return [];
    }

    // Normaliser : passer en majuscules et trim
    const normalized = label.trim().toUpperCase();
    
    // Séparer sur espace, "-" et "_"
    const tokens = normalized.split(/[\s\-_]+/);
    
    // Filtrer les mots avec longueur >= MIN_WORD_LENGTH
    return tokens.filter(token => token.length >= MIN_WORD_LENGTH);
  }

  /**
   * Vérifie si un mot est 100% numérique
   */
  static isNumericWord(word: string): boolean {
    return /^\d+$/.test(word);
  }

  /**
   * Met à jour les statistiques pour un libellé et une catégorie donnés
   * Apprentissage en ligne : incrémente les compteurs pour chaque mot du libellé
   */
  static updateStatsForLabel(
    label: string,
    category: string,
    stats: WordStatsMap
  ): WordStatsMap {
    if (!label || !category || category.trim() === '') {
      return stats;
    }

    const tokens = this.tokenizeLabel(label);
    const updatedStats = { ...stats };

    for (const token of tokens) {
      // Normaliser le mot (déjà fait dans tokenizeLabel, mais on s'assure)
      const word = token.toUpperCase().trim();

      if (word.length < MIN_WORD_LENGTH) {
        continue;
      }

      // Initialiser les stats du mot s'il n'existe pas encore
      if (!updatedStats[word]) {
        updatedStats[word] = {
          totalCount: 0,
          length: word.length,
          isNumeric: this.isNumericWord(word),
          catCounts: {},
        };
      }

      // Incrémenter le compteur total
      updatedStats[word].totalCount += 1;

      // Incrémenter le compteur pour cette catégorie
      if (!updatedStats[word].catCounts[category]) {
        updatedStats[word].catCounts[category] = 0;
      }
      updatedStats[word].catCounts[category] += 1;
    }

    return updatedStats;
  }

  /**
   * Calcule les scores pour chaque catégorie pour un libellé donné
   */
  static scoreCategoriesForLabel(
    label: string,
    stats: WordStatsMap
  ): Record<string, number> {
    const tokens = this.tokenizeLabel(label);
    const categoryScores: Record<string, number> = {};

    for (const token of tokens) {
      const word = token.toUpperCase().trim();

      // Ignorer les mots numériques
      if (this.isNumericWord(word)) {
        continue;
      }

      // Récupérer les stats du mot
      const wordStats = stats[word];
      if (!wordStats || wordStats.totalCount === 0) {
        continue;
      }

      // Calculer le poids du mot (facteur pour les mots courts)
      let wordWeight = 1.0;
      if (wordStats.length < SHORT_WORD_THRESHOLD) {
        wordWeight = SHORT_WORD_FACTOR;
      }

      // Calculer la distribution par catégorie pour ce mot
      // p(cat | mot) = catCounts[cat] / totalCount
      for (const [category, count] of Object.entries(wordStats.catCounts)) {
        const probability = count / wordStats.totalCount;
        const contribution = wordWeight * probability;

        if (!categoryScores[category]) {
          categoryScores[category] = 0;
        }
        categoryScores[category] += contribution;
      }
    }

    return categoryScores;
  }

  /**
   * Suggère la meilleure catégorie pour un libellé donné
   */
  static suggestBestCategory(
    label: string,
    stats: WordStatsMap
  ): CategorySuggestion {
    const scores = this.scoreCategoriesForLabel(label, stats);

    // Trouver la catégorie avec le score le plus élevé
    let bestCategory: string | null = null;
    let bestScore = 0;

    for (const [category, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    // Appliquer le seuil minimum
    if (bestScore < MIN_SUGGESTION_SCORE) {
      return {
        category: null,
        scores,
        confidence: 0,
      };
    }

    return {
      category: bestCategory,
      scores,
      confidence: bestScore,
    };
  }

  /**
   * Met à jour les statistiques pour plusieurs libellés (utile pour l'initialisation)
   */
  static batchUpdateStats(
    labels: Array<{ label: string; category: string }>,
    stats: WordStatsMap
  ): WordStatsMap {
    let updatedStats = { ...stats };

    for (const { label, category } of labels) {
      if (label && category && category.trim() !== '') {
        updatedStats = this.updateStatsForLabel(label, category, updatedStats);
      }
    }

    return updatedStats;
  }
}

