import { isValid } from 'date-fns';
import {
  ColumnMappingConfig,
  FileStructure,
  OverlapWarning,
  PreviewRow,
} from '../types/import';
import { parseDateWithMultipleFormats, toIsoDate } from '../utils/dateFormats';
import { parseAmount, roundMoney } from '../utils/amounts';
import { Db } from './db';
import { withLog } from './logger';
import { ConfigService } from './ConfigService';
import { LabelRuleService } from './LabelRuleService';
import { neutralizeFormula } from '../utils/security';

function cell(row: unknown[], index: number): unknown {
  return row[index];
}

export function transformRows(
  structure: FileStructure,
  mapping: ColumnMappingConfig
): PreviewRow[] {
  const dataRows = structure.rawData.slice(structure.dataStartRowIndex);
  const isSingle = mapping.debitColumnIndex === mapping.creditColumnIndex;
  const result: PreviewRow[] = [];

  for (const row of dataRows) {
    if (!row || row.length === 0) continue;
    const date = parseDateWithMultipleFormats(cell(row, mapping.dateColumnIndex));
    if (!date || !isValid(date)) continue;
    const valueDateRaw =
      mapping.dateValueColumnIndex !== undefined
        ? parseDateWithMultipleFormats(cell(row, mapping.dateValueColumnIndex))
        : date;
    const valueDate = valueDateRaw && isValid(valueDateRaw) ? valueDateRaw : date;
    let debit = 0;
    let credit = 0;
    if (isSingle) {
      const amount = parseAmount(cell(row, mapping.debitColumnIndex));
      if (amount < 0) debit = amount;
      else if (amount > 0) credit = amount;
    } else {
      debit = parseAmount(cell(row, mapping.debitColumnIndex));
      credit = parseAmount(cell(row, mapping.creditColumnIndex));
      if (debit > 0) debit = -debit;
      if (credit < 0) credit = Math.abs(credit);
    }
    result.push({
      date: toIsoDate(date),
      valueDate: toIsoDate(valueDate),
      debit: roundMoney(debit),
      credit: roundMoney(credit),
      label: neutralizeFormula(String(cell(row, mapping.libelleColumnIndex) ?? '').trim()),
    });
  }

  result.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

export const ImportService = {
  transformRows,

  async findOverlaps(
    accountId: number,
    dateStart: string,
    dateEnd: string
  ): Promise<OverlapWarning[]> {
    return withLog('ImportService.findOverlaps', async () => {
      const rows = await Db.select<{
        id: number;
        filename: string;
        date_start: string | null;
        date_end: string | null;
      }>(
        `SELECT id, filename, date_start, date_end FROM imports
         WHERE account_id = ?
           AND date_start IS NOT NULL AND date_end IS NOT NULL
           AND date_start <= ? AND date_end >= ?`,
        [accountId, dateEnd, dateStart]
      );
      return rows.map((r) => ({
        importId: r.id,
        filename: r.filename,
        dateStart: r.date_start,
        dateEnd: r.date_end,
      }));
    }, { data: { accountId, dateStart, dateEnd } });
  },

  async importRows(input: {
    accountId: number;
    filename: string;
    rows: PreviewRow[];
    initialBalance?: number;
  }): Promise<{ imported: number; importId: number | null }> {
    return withLog('ImportService.importRows', async () => {
      if (input.rows.length === 0) return { imported: 0, importId: null };
      const dates = input.rows.map((r) => r.date).sort();
      let importId: number | null = null;
      let imported = 0;
      try {
        await Db.inTransaction('ImportService.importRows', async () => {
          if (input.initialBalance !== undefined) {
            await ConfigService.updateAccount(input.accountId, {
              initialBalance: input.initialBalance,
            });
          }
          const importRes = await Db.execute(
            'INSERT INTO imports (filename, account_id, date_start, date_end, row_count) VALUES (?, ?, ?, ?, ?)',
            [input.filename, input.accountId, dates[0], dates[dates.length - 1], input.rows.length]
          );
          importId = importRes.lastInsertId ?? null;
          const chunkSize = 100;
          for (let i = 0; i < input.rows.length; i += chunkSize) {
            const chunk = input.rows.slice(i, i + chunkSize);
            const placeholders: string[] = [];
            const params: unknown[] = [];
            for (const row of chunk) {
              placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?)');
              params.push(
                input.accountId,
                row.date,
                row.valueDate,
                row.debit,
                row.credit,
                row.label,
                null,
                importId
              );
            }
            await Db.execute(
              `INSERT INTO transactions (account_id, date, value_date, debit, credit, label, category_code, import_id)
               VALUES ${placeholders.join(', ')}`,
              params
            );
            imported += placeholders.length;
          }
        });
        if (importId != null) {
          await LabelRuleService.apply({ importId });
        }
        return { imported, importId };
      } catch (err) {
        if (importId != null) {
          await Db.execute('DELETE FROM transactions WHERE import_id = ?', [importId]).catch(
            () => undefined
          );
          await Db.execute('DELETE FROM imports WHERE id = ?', [importId]).catch(() => undefined);
        }
        throw err;
      }
    }, { data: { accountId: input.accountId, filename: input.filename, count: input.rows.length } });
  },
};
