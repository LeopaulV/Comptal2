import { save } from '@tauri-apps/plugin-dialog';
import { StatsFilters, StatsService, TransactionListRow } from './StatsService';
import { tauriBridge } from './tauri';
import { withLog } from './logger';
import { formatFrDate } from '../utils/dateFormats';
import { csvQuote } from '../utils/security';
import { InvoiceService } from './InvoiceService';
import { PluginService } from './PluginService';
import { ExportCsvField, PluginExportMapper } from '../types/plugin';

const DEFAULT_HEADERS: Array<{ header: string; field: ExportCsvField }> = [
  { header: 'Date', field: 'date' },
  { header: 'Compte', field: 'account' },
  { header: 'Libellé', field: 'label' },
  { header: 'Débit', field: 'debit' },
  { header: 'Crédit', field: 'credit' },
  { header: 'Catégorie', field: 'category' },
  { header: 'N° facture', field: 'invoiceNumero' },
];

interface AccountantRow extends TransactionListRow {
  invoiceNumero: string;
}

function fieldValue(row: AccountantRow, field: ExportCsvField): string {
  switch (field) {
    case 'date':
      return formatFrDate(row.date);
    case 'account':
      return row.accountCode;
    case 'label':
      return row.label;
    case 'debit':
      return row.debit ? String(row.debit).replace('.', ',') : '';
    case 'credit':
      return row.credit ? String(row.credit).replace('.', ',') : '';
    case 'category':
      return row.categoryCode ?? '';
    case 'invoiceNumero':
      return row.invoiceNumero;
  }
}

function rowsToCsv(rows: AccountantRow[], mapper?: PluginExportMapper | null): string {
  const delimiter = mapper?.delimiter ?? ';';
  const columns = mapper?.columns?.length ? mapper.columns : DEFAULT_HEADERS;
  const header = columns.map((col) => csvQuote(col.header)).join(delimiter);
  const lines = rows.map((row) =>
    columns.map((col) => csvQuote(fieldValue(row, col.field))).join(delimiter)
  );
  return [header, ...lines].join('\n');
}

async function invoiceNumeroByTx(): Promise<Map<string, string>> {
  const factures = await InvoiceService.loadFactures();
  const map = new Map<string, string>();
  for (const facture of factures) {
    if (facture.supprime) continue;
    for (const paiement of facture.paiements) {
      if (paiement.transactionId) {
        const previous = map.get(paiement.transactionId);
        map.set(
          paiement.transactionId,
          previous ? `${previous}, ${facture.numero}` : facture.numero
        );
      }
    }
  }
  return map;
}

export const ExportService = {
  async exportTransactionsCsv(filters: StatsFilters): Promise<void> {
    return this.exportAccountantCsv(filters);
  },

  async exportAccountantCsv(filters: StatsFilters): Promise<void> {
    return withLog('ExportService.exportAccountantCsv', async () => {
      const [rows, invoiceMap, mapper] = await Promise.all([
        StatsService.listAllTransactions(filters),
        invoiceNumeroByTx(),
        PluginService.getActiveExportMapper().catch(() => null),
      ]);
      const accountantRows: AccountantRow[] = rows.map((row) => ({
        ...row,
        invoiceNumero: invoiceMap.get(String(row.id)) ?? '',
      }));
      const dest = await save({
        defaultPath: `comptal_tresorerie_${filters.dateStart ?? 'all'}_${filters.dateEnd ?? 'all'}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
      if (!dest) return;
      await tauriBridge.writeExternalTextFile(dest, rowsToCsv(accountantRows, mapper));
    });
  },
};
