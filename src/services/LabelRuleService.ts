import { LabelRule, LabelRuleInput } from '../types/labelRule';
import i18n from '../i18n/config';
import { Db } from './db';
import { withLog } from './logger';
import { EditionUpdateFields } from '../types/editionHistory';
import { sqlTxActive } from '../utils/sqlTx';

export const MIN_SEQUENCE_LENGTH = 4;

interface RuleRow {
  id: number;
  word: string;
  category_code: string | null;
  tag: string | null;
  active: number;
  created_at: string;
}

interface TxMatchRow {
  id: number;
  label: string;
  category_code: string | null;
  tag: string | null;
}

function mapRule(row: RuleRow): LabelRule {
  return {
    id: row.id,
    word: row.word,
    categoryCode: row.category_code,
    tag: row.tag,
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

/** Conserve la suite de caractères (espaces internes inclus), en majuscules. */
export function normalizeSequence(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toUpperCase();
}

function isWordChar(char: string | undefined): boolean {
  return Boolean(char && /[A-Z0-9]/.test(char));
}

function labelContainsSequence(label: string, sequence: string): boolean {
  if (!sequence) return false;
  const hay = label.toUpperCase();
  const needle = sequence.toUpperCase();
  let from = 0;
  while (from <= hay.length - needle.length) {
    const idx = hay.indexOf(needle, from);
    if (idx < 0) return false;
    const before = idx === 0 || !isWordChar(hay[idx - 1]);
    const after = idx + needle.length >= hay.length || !isWordChar(hay[idx + needle.length]);
    if (before && after) return true;
    from = idx + 1;
  }
  return false;
}

function matchRule(label: string, rules: LabelRule[]): LabelRule | null {
  if (rules.length === 0) return null;
  for (const rule of rules) {
    if (labelContainsSequence(label, rule.word)) return rule;
  }
  return null;
}

function sortRules(rules: LabelRule[]): LabelRule[] {
  return rules
    .filter((rule) => rule.active)
    .slice()
    .sort((a, b) => b.word.length - a.word.length || a.word.localeCompare(b.word));
}

export interface LabelApplyChange {
  id: number;
  before: EditionUpdateFields;
  after: EditionUpdateFields;
}

export const LabelRuleService = {
  normalizeSequence,
  MIN_SEQUENCE_LENGTH,

  async list(): Promise<LabelRule[]> {
    return withLog('LabelRuleService.list', async () => {
      const rows = await Db.select<RuleRow>(
        'SELECT id, word, category_code, tag, active, created_at FROM label_rules ORDER BY word'
      );
      return rows.map(mapRule);
    });
  },

  async listDistinctTags(): Promise<string[]> {
    return withLog('LabelRuleService.listDistinctTags', async () => {
      const fromRules = await Db.select<{ tag: string }>(
        `SELECT DISTINCT tag FROM label_rules
         WHERE tag IS NOT NULL AND tag != ''
         ORDER BY tag COLLATE NOCASE`
      );
      const fromTx = await Db.select<{ tag: string }>(
        `SELECT DISTINCT tag FROM transactions
         WHERE tag IS NOT NULL AND tag != '' AND ${sqlTxActive()}
         ORDER BY tag COLLATE NOCASE`
      );
      const set = new Set<string>();
      for (const row of [...fromRules, ...fromTx]) {
        if (row.tag) set.add(row.tag);
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    });
  },

  async upsert(input: LabelRuleInput): Promise<LabelRule> {
    return withLog('LabelRuleService.upsert', async () => {
      const word = normalizeSequence(input.word);
      if (word.length < MIN_SEQUENCE_LENGTH) throw new Error(i18n.t('errors.sequenceTooShort'));
      const categoryCode = input.categoryCode?.trim() || null;
      if (!categoryCode) throw new Error(i18n.t('errors.categoryRequired'));
      await Db.execute(
        `INSERT INTO label_rules (word, category_code, tag, active, created_at)
         VALUES (?, ?, NULL, 1, datetime('now'))
         ON CONFLICT(word) DO UPDATE SET
           category_code = excluded.category_code,
           tag = NULL,
           active = 1`,
        [word, categoryCode]
      );
      const rows = await Db.select<RuleRow>(
        'SELECT id, word, category_code, tag, active, created_at FROM label_rules WHERE word = ?',
        [word]
      );
      if (!rows[0]) throw new Error(i18n.t('errors.ruleNotFound'));
      return mapRule(rows[0]);
    }, { data: { categoryCode: input.categoryCode } });
  },

  async remove(id: number): Promise<void> {
    return withLog('LabelRuleService.remove', async () => {
      await Db.execute('DELETE FROM label_rules WHERE id = ?', [id]);
    }, { data: { id } });
  },

  match(label: string, rules: LabelRule[]): LabelRule | null {
    return matchRule(label, sortRules(rules));
  },

  async preview(options?: { ids?: number[]; importId?: number }): Promise<number> {
    const changes = await this.collectChanges(options);
    return changes.length;
  },

  async applyChanges(options?: { ids?: number[]; importId?: number }): Promise<LabelApplyChange[]> {
    return withLog('LabelRuleService.applyChanges', async () => {
      const planned = await this.collectChanges(options);
      if (planned.length === 0) return [];
      await Db.inTransaction('LabelRuleService.apply', async () => {
        for (const change of planned) {
          await Db.execute(
            `UPDATE transactions
             SET category_code = ?, updated_at = datetime('now')
             WHERE id = ?`,
            [change.after.categoryCode, change.id]
          );
        }
      });
      return planned;
    }, {
      data: {
        ids: options?.ids?.length ?? 0,
        importId: options?.importId ?? null,
      },
    });
  },

  async apply(options?: { ids?: number[]; importId?: number }): Promise<number> {
    const changes = await this.applyChanges(options);
    return changes.length;
  },

  async collectChanges(options?: { ids?: number[]; importId?: number }): Promise<LabelApplyChange[]> {
    const rules = sortRules(await this.list());
    if (rules.length === 0) return [];

    const clauses: string[] = [];
    const params: unknown[] = [];
    if (options?.ids && options.ids.length > 0) {
      clauses.push(`id IN (${options.ids.map(() => '?').join(',')})`);
      params.push(...options.ids);
    }
    if (options?.importId != null) {
      clauses.push('import_id = ?');
      params.push(options.importId);
    }
    const extra = sqlTxActive();
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')} AND ${extra}` : `WHERE ${extra}`;
    const rows = await Db.select<TxMatchRow>(
      `SELECT id, label, category_code, tag FROM transactions ${where}`,
      params
    );

    const planned: LabelApplyChange[] = [];
    for (const row of rows) {
      const rule = matchRule(row.label, rules);
      if (!rule?.categoryCode) continue;
      if (row.category_code) continue;
      planned.push({
        id: row.id,
        before: { categoryCode: row.category_code },
        after: { categoryCode: rule.categoryCode },
      });
    }
    return planned;
  },
};
