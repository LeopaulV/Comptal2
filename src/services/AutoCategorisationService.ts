import { Db } from './db';
import { withLog } from './logger';
import { sqlTxActive } from '../utils/sqlTx';

const MIN_WORD_LENGTH = 2;
const SHORT_WORD_FACTOR = 0.95;
const SHORT_WORD_THRESHOLD = 4;
const MIN_SUGGESTION_SCORE = 0.1;

export interface CategorySuggestion {
  category: string | null;
  confidence: number;
}

function tokenizeLabel(label: string): string[] {
  if (!label) return [];
  return label
    .trim()
    .toUpperCase()
    .split(/[\s\-_]+/)
    .filter((token) => token.length >= MIN_WORD_LENGTH);
}

function isNumericWord(word: string): boolean {
  return /^\d+$/.test(word);
}

interface StatRow {
  word: string;
  category_code: string;
  count: number;
}

export const AutoCategorisationService = {
  tokenizeLabel,
  isNumericWord,

  async loadStats(): Promise<Map<string, { total: number; cats: Record<string, number> }>> {
    const rows = await Db.select<StatRow>(
      'SELECT word, category_code, count FROM autocat_stats'
    );
    const map = new Map<string, { total: number; cats: Record<string, number> }>();
    for (const row of rows) {
      const current = map.get(row.word) ?? { total: 0, cats: {} };
      current.cats[row.category_code] = row.count;
      current.total += row.count;
      map.set(row.word, current);
    }
    return map;
  },

  async learn(label: string, category: string): Promise<void> {
    if (!label || !category.trim()) return;
    return withLog('AutoCategorisationService.learn', async () => {
      const tokens = tokenizeLabel(label);
      for (const token of tokens) {
        await Db.execute(
          `INSERT INTO autocat_stats (word, category_code, count) VALUES (?, ?, 1)
           ON CONFLICT(word, category_code) DO UPDATE SET count = count + 1`,
          [token, category]
        );
      }
    });
  },

  suggest(
    label: string,
    stats: Map<string, { total: number; cats: Record<string, number> }>
  ): CategorySuggestion {
    const tokens = tokenizeLabel(label);
    const scores: Record<string, number> = {};
    for (const token of tokens) {
      if (isNumericWord(token)) continue;
      const wordStats = stats.get(token);
      if (!wordStats || wordStats.total === 0) continue;
      const weight = token.length < SHORT_WORD_THRESHOLD ? SHORT_WORD_FACTOR : 1;
      for (const [category, count] of Object.entries(wordStats.cats)) {
        scores[category] = (scores[category] ?? 0) + weight * (count / wordStats.total);
      }
    }
    let bestCategory: string | null = null;
    let bestScore = 0;
    for (const [category, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }
    const meaningful = tokens.filter((t) => !isNumericWord(t));
    const known = meaningful.filter((t) => stats.get(t)?.total).length;
    const penalty = meaningful.length > 0 ? (known / meaningful.length) ** 2 : 1;
    const confidence = Math.min(1, Math.max(0, bestScore)) * penalty;
    if (confidence < MIN_SUGGESTION_SCORE) return { category: null, confidence: 0 };
    return { category: bestCategory, confidence };
  },

  async rebuildFromTransactions(): Promise<number> {
    return withLog('AutoCategorisationService.rebuildFromTransactions', async () => {
      await Db.execute('DELETE FROM autocat_stats');
      const rows = await Db.select<{ label: string; category_code: string }>(
        `SELECT label, category_code FROM transactions
         WHERE category_code IS NOT NULL AND category_code != '' AND ${sqlTxActive()}`
      );
      for (const row of rows) {
        const tokens = tokenizeLabel(row.label);
        for (const token of tokens) {
          await Db.execute(
            `INSERT INTO autocat_stats (word, category_code, count) VALUES (?, ?, 1)
             ON CONFLICT(word, category_code) DO UPDATE SET count = count + 1`,
            [token, row.category_code]
          );
        }
      }
      return rows.length;
    });
  },
};
