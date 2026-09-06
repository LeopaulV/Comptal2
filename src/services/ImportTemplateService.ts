import {
  ColumnInfo,
  ColumnRole,
  ColumnRolesByHeader,
  ImportTemplate,
  ImportTemplateInput,
} from '../types/import';
import { Db } from './db';
import { withLog } from './logger';
import { isPlainObject, MAX_TEMPLATE_ROLE_KEYS } from '../utils/security';

interface TemplateRow {
  id: number;
  name: string;
  account_id: number | null;
  initial_balance: number | null;
  column_roles_json: string;
  created_at: string;
  updated_at: string | null;
}

const ALLOWED_ROLES = new Set<ColumnRole>([
  'date',
  'dateValue',
  'libelle',
  'debit',
  'credit',
  'debitCredit',
  'balance',
  'ignore',
]);

function parseColumnRoles(raw: string): ColumnRolesByHeader {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!isPlainObject(parsed)) return {};
  const out: ColumnRolesByHeader = {};
  let count = 0;
  for (const [key, value] of Object.entries(parsed)) {
    if (count >= MAX_TEMPLATE_ROLE_KEYS) break;
    if (typeof key !== 'string' || typeof value !== 'string') continue;
    if (!ALLOWED_ROLES.has(value as ColumnRole)) continue;
    out[key] = value as ColumnRole;
    count += 1;
  }
  return out;
}

function serializeColumnRoles(roles: ColumnRolesByHeader): string {
  return JSON.stringify(parseColumnRoles(JSON.stringify(roles)));
}

function mapRow(row: TemplateRow): ImportTemplate {
  return {
    id: row.id,
    name: row.name,
    accountId: row.account_id,
    initialBalance: row.initial_balance,
    columnRoles: parseColumnRoles(row.column_roles_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const REQUIRED_ROLES: ColumnRole[] = ['date', 'libelle'];

function hasAmountRole(roles: ColumnRolesByHeader): boolean {
  const values = Object.values(roles);
  return (
    values.includes('debitCredit') ||
    values.includes('debit') ||
    values.includes('credit')
  );
}

export const ImportTemplateService = {
  async list(): Promise<ImportTemplate[]> {
    return withLog('ImportTemplateService.list', async () => {
      const rows = await Db.select<TemplateRow>(
        `SELECT id, name, account_id, initial_balance, column_roles_json, created_at, updated_at
         FROM import_templates ORDER BY name COLLATE NOCASE`
      );
      return rows.map(mapRow);
    });
  },

  async create(input: ImportTemplateInput): Promise<number> {
    return withLog('ImportTemplateService.create', async () => {
      const res = await Db.execute(
        `INSERT INTO import_templates (name, account_id, initial_balance, column_roles_json)
         VALUES (?, ?, ?, ?)`,
        [
          input.name.trim(),
          input.accountId ?? null,
          input.initialBalance ?? null,
          serializeColumnRoles(input.columnRoles),
        ]
      );
      return res.lastInsertId ?? 0;
    }, { data: { name: input.name } });
  },

  async update(id: number, input: ImportTemplateInput): Promise<void> {
    return withLog('ImportTemplateService.update', async () => {
      await Db.execute(
        `UPDATE import_templates
         SET name = ?, account_id = ?, initial_balance = ?, column_roles_json = ?,
             updated_at = datetime('now')
         WHERE id = ?`,
        [
          input.name.trim(),
          input.accountId ?? null,
          input.initialBalance ?? null,
          serializeColumnRoles(input.columnRoles),
          id,
        ]
      );
    }, { data: { id } });
  },

  async remove(id: number): Promise<void> {
    return withLog('ImportTemplateService.remove', async () => {
      await Db.execute('DELETE FROM import_templates WHERE id = ?', [id]);
    }, { data: { id } });
  },

  /**
   * Retourne le premier template dont tous les en-têtes mappés (hors ignore)
   * existent dans `headers`, et qui couvre date + libellé + montant.
   */
  async findMatching(headers: string[]): Promise<ImportTemplate | null> {
    return withLog('ImportTemplateService.findMatching', async () => {
      const templates = await this.list();
      const headerSet = new Set(headers.map((h) => h.trim().toLowerCase()));
      for (const tpl of templates) {
        const entries = Object.entries(tpl.columnRoles).filter(
          ([, role]) => role !== 'ignore'
        );
        if (entries.length === 0) continue;
        const allPresent = entries.every(([name]) =>
          headerSet.has(name.trim().toLowerCase())
        );
        if (!allPresent) continue;
        const roles = Object.values(tpl.columnRoles);
        const hasRequired = REQUIRED_ROLES.every((r) => roles.includes(r));
        if (!hasRequired || !hasAmountRole(tpl.columnRoles)) continue;
        return tpl;
      }
      return null;
    });
  },

  /** Applique un template (par noms d'en-têtes) sur les colonnes analysées. */
  applyToColumns(
    template: ImportTemplate,
    columns: ColumnInfo[]
  ): Map<number, ColumnRole> {
    const roles = new Map<number, ColumnRole>();
    const byName = new Map(
      columns.map((c) => [c.name.trim().toLowerCase(), c.index])
    );
    for (const [header, role] of Object.entries(template.columnRoles)) {
      const index = byName.get(header.trim().toLowerCase());
      if (index !== undefined) {
        roles.set(index, role);
      }
    }
    return roles;
  },

  /** Sérialise le mapping courant (index → rôle) en en-têtes → rôle. */
  rolesToHeaders(
    roles: Map<number, ColumnRole>,
    columns: ColumnInfo[]
  ): ColumnRolesByHeader {
    const out: ColumnRolesByHeader = {};
    for (const col of columns) {
      const role = roles.get(col.index);
      if (role && role !== 'ignore') {
        out[col.name] = role;
      }
    }
    return out;
  },
};
