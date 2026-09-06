// Migration d'un profil Comptal2 (CSV + JSON) vers la base SQLite de Comptal2.1.
// Source attendue : un dossier contenant parametre/ (account.json, categories.json)
// et data/ (fichiers CSV au format Source;Compte;Date;...).
import Papa from 'papaparse';
import { tauriBridge } from './tauri';
import { Db } from './db';
import { Logger, withLog } from './logger';

export interface MigrationAnalysis {
  valid: boolean;
  reason?: string;
  accountCount: number;
  categoryCount: number;
  csvFileCount: number;
}

export interface MigrationResult {
  accountsCreated: number;
  categoriesCreated: number;
  filesImported: number;
  rowsImported: number;
  invoicingImported: number;
}

interface Comptal2CsvRow {
  Source?: string;
  Compte?: string;
  Date?: string;
  'Date de valeur'?: string;
  ['Débit']?: string;
  ['Crédit']?: string;
  ['Libellé']?: string;
  Solde?: string;
  ['catégorie']?: string;
  ['Solde initial']?: string;
  Index?: string;
}

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[\s\u00a0€]/g, '').replace(',', '.');
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
}

/** dd/MM/yyyy -> yyyy-MM-dd (accepte aussi une date déjà ISO). */
function parseDateToIso(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

async function readJsonExternal<T>(abs: string): Promise<T | null> {
  try {
    const content = await tauriBridge.readExternalTextFile(abs);
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function joinAbs(base: string, ...parts: string[]): string {
  const root = base.replace(/\\/g, '/').replace(/\/$/, '');
  return parts.reduce((acc, part) => `${acc}/${part.replace(/^\/+/, '')}`, root);
}

/** Chemin absolu du dossier profil Comptal2.1 (profils/{id}). */
export function profileAbsPath(profileId: string): string {
  const session = Logger.session;
  if (!session) {
    throw new Error('Logger non initialisé');
  }
  return joinAbs(session.dataRoot, 'profils', profileId);
}

async function importInvoicingJson(parametreDir: string): Promise<number> {
  let count = 0;
  const { EmetteurService } = await import('./EmetteurService');
  const { PDFTemplateService } = await import('./PDFTemplateService');
  const { LegalMentionsService } = await import('./LegalMentionsService');
  const { ClientService } = await import('./ClientService');
  const { InvoiceService } = await import('./InvoiceService');
  const { PosteService, PosteAssociationService } = await import('./PosteService');
  const { SecteurService } = await import('./SecteurService');
  const { AssociationConfigService } = await import('./AssociationConfigService');
  const { DonateurService } = await import('./DonateurService');
  const { DonsService } = await import('./DonsService');
  const { RegistreRecusService } = await import('./RegistreRecusService');

  const extended =
    (await readJsonExternal<unknown>(joinAbs(parametreDir, 'emetteur_extended.json'))) ??
    (await readJsonExternal<unknown>(joinAbs(parametreDir, 'emetteur.json')));
  const settings = await readJsonExternal<unknown>(joinAbs(parametreDir, 'invoice_settings.json'));
  if (extended || settings) {
    await EmetteurService.importRaw(extended, settings);
    count += 1;
  }

  const templates = await readJsonExternal<unknown[]>(joinAbs(parametreDir, 'pdf_templates.json'));
  if (templates) {
    await PDFTemplateService.importList(templates);
    count += 1;
  }
  const mentions = await readJsonExternal<unknown[]>(joinAbs(parametreDir, 'mentions_legales.json'));
  if (mentions) {
    await LegalMentionsService.importList(mentions);
    count += 1;
  }
  const clients = await readJsonExternal<unknown[]>(joinAbs(parametreDir, 'clients.json'));
  if (clients) {
    count += await ClientService.importList(clients);
  }
  const devis = await readJsonExternal<unknown[]>(joinAbs(parametreDir, 'devis.json'));
  if (devis) count += await InvoiceService.importDevisList(devis);
  const factures = await readJsonExternal<unknown[]>(joinAbs(parametreDir, 'factures.json'));
  if (factures) count += await InvoiceService.importFacturesList(factures);

  const postes = await readJsonExternal<unknown[]>(joinAbs(parametreDir, 'postes_catalogue.json'));
  const groupes = await readJsonExternal<unknown[]>(joinAbs(parametreDir, 'postes_groupes.json'));
  if (postes || groupes) {
    await PosteService.importRaw(postes ?? [], groupes ?? []);
    count += 1;
  }
  const secteurs = await readJsonExternal<unknown[]>(joinAbs(parametreDir, 'secteurs_activite.json'));
  if (secteurs) {
    await SecteurService.importList(secteurs);
    count += 1;
  }

  const asso = await readJsonExternal<unknown>(joinAbs(parametreDir, 'association_config.json'));
  if (asso) {
    await AssociationConfigService.importRaw(asso);
    count += 1;
  }
  const donateurs = await readJsonExternal<unknown[]>(joinAbs(parametreDir, 'donateurs.json'));
  const mapping = await readJsonExternal<Record<string, string>>(
    joinAbs(parametreDir, 'donateur_transactions.json')
  );
  if (donateurs || mapping) {
    await DonateurService.importList(donateurs ?? [], mapping ?? undefined);
    count += 1;
  }
  const dons = await readJsonExternal<unknown[]>(joinAbs(parametreDir, 'dons_manuels.json'));
  if (dons) {
    await DonsService.importList(dons);
    count += 1;
  }
  const recus = await readJsonExternal<unknown[]>(joinAbs(parametreDir, 'registre_recus.json'));
  if (recus) {
    await RegistreRecusService.importList(recus);
    count += 1;
  }
  const postesAsso = await readJsonExternal<unknown[]>(joinAbs(parametreDir, 'postes_association.json'));
  const groupesAsso = await readJsonExternal<unknown[]>(
    joinAbs(parametreDir, 'postes_groupes_association.json')
  );
  if (postesAsso || groupesAsso) {
    await PosteAssociationService.importRaw(postesAsso ?? [], groupesAsso ?? []);
    count += 1;
  }

  Logger.info('MigrationService.importInvoicingJson', 'JSON facturation/association importés', { count });
  return count;
}

export const MigrationService = {
  /** Vérifie qu'un dossier ressemble à un profil Comptal2 et compte son contenu. */
  async analyze(sourceAbs: string): Promise<MigrationAnalysis> {
    return withLog('MigrationService.analyze', async () => {
      const parametreDir = joinAbs(sourceAbs, 'parametre');
      const dataDir = joinAbs(sourceAbs, 'data');
      const hasParametre = await tauriBridge.externalExists(parametreDir);
      const hasData = await tauriBridge.externalExists(dataDir);
      if (!hasParametre || !hasData) {
        return {
          valid: false,
          reason: 'Le dossier doit contenir les sous-dossiers "parametre" et "data" (profil Comptal2).',
          accountCount: 0,
          categoryCount: 0,
          csvFileCount: 0,
        };
      }
      const accounts =
        (await readJsonExternal<Record<string, { name: string; color: string }>>(
          joinAbs(parametreDir, 'account.json')
        )) ?? {};
      const categories =
        (await readJsonExternal<Record<string, { name: string; color: string }>>(
          joinAbs(parametreDir, 'categories.json')
        )) ?? {};
      const dataEntries = await tauriBridge.readExternalDir(dataDir);
      const csvFiles = dataEntries.filter((e) => !e.isDir && e.name.toLowerCase().endsWith('.csv'));
      return {
        valid: true,
        accountCount: Object.keys(accounts).length,
        categoryCount: Object.keys(categories).length,
        csvFileCount: csvFiles.length,
      };
    }, { data: { sourceAbs } });
  },

  /**
   * Si le profil contient encore des CSV/JSON Comptal2 et que SQLite est vide,
   * lance la migration (import ZIP Comptal2 ou profil non migré).
   */
  async migrateLegacyProfileIfNeeded(profileId: string): Promise<MigrationResult | null> {
    return withLog('MigrationService.migrateLegacyProfileIfNeeded', async () => {
      const abs = profileAbsPath(profileId);
      const hasLegacy =
        (await tauriBridge.externalExists(joinAbs(abs, 'parametre'))) &&
        (await tauriBridge.externalExists(joinAbs(abs, 'data')));
      if (!hasLegacy) {
        return null;
      }
      const txRows = await Db.select<{ c: number }>('SELECT COUNT(*) AS c FROM transactions');
      if ((txRows[0]?.c ?? 0) > 0) {
        return null;
      }
      const analysis = await this.analyze(abs);
      if (!analysis.valid) {
        Logger.warn(
          'MigrationService.migrateLegacyProfileIfNeeded',
          analysis.reason ?? 'Profil legacy non migrable'
        );
        return null;
      }
      return this.migrate(abs);
    }, { data: { profileId } });
  },

  /** Migre le profil Comptal2 vers la base SQLite du profil actif. */
  async migrate(
    sourceAbs: string,
    onProgress?: (message: string) => void
  ): Promise<MigrationResult> {
    return withLog('MigrationService.migrate', async () => {
      const parametreDir = joinAbs(sourceAbs, 'parametre');
      const dataDir = joinAbs(sourceAbs, 'data');
      const result: MigrationResult = {
        accountsCreated: 0,
        categoriesCreated: 0,
        filesImported: 0,
        rowsImported: 0,
        invoicingImported: 0,
      };

      // 1. Comptes
      onProgress?.('Migration des comptes…');
      const accountsJson =
        (await readJsonExternal<Record<string, { name: string; color: string }>>(
          joinAbs(parametreDir, 'account.json')
        )) ?? {};
      const soldesJson =
        (await readJsonExternal<Record<string, number | { solde?: number }>>(
          joinAbs(parametreDir, 'solde_compte.json')
        )) ?? {};
      for (const [code, info] of Object.entries(accountsJson)) {
        const soldeRaw = soldesJson[code];
        const initial =
          typeof soldeRaw === 'number'
            ? soldeRaw
            : typeof soldeRaw === 'object' && typeof soldeRaw?.solde === 'number'
              ? soldeRaw.solde
              : 0;
        const inserted = await Db.execute(
          'INSERT OR IGNORE INTO accounts (code, name, color, initial_balance) VALUES (?, ?, ?, ?)',
          [code, info.name ?? code, info.color ?? '#4a90e2', initial]
        );
        result.accountsCreated += inserted.rowsAffected;
      }

      // 2. Catégories
      onProgress?.('Migration des catégories…');
      const categoriesJson =
        (await readJsonExternal<Record<string, { name: string; color: string }>>(
          joinAbs(parametreDir, 'categories.json')
        )) ?? {};
      for (const [code, info] of Object.entries(categoriesJson)) {
        const inserted = await Db.execute(
          'INSERT OR IGNORE INTO categories (code, name, color) VALUES (?, ?, ?)',
          [code, info.name ?? code, info.color ?? '#94a3b8']
        );
        result.categoriesCreated += inserted.rowsAffected;
      }

      // 3. Transactions (CSV par fichier)
      const dataEntries = await tauriBridge.readExternalDir(dataDir);
      const csvFiles = dataEntries.filter((e) => !e.isDir && e.name.toLowerCase().endsWith('.csv'));

      // Index code/nom -> id pour résoudre la colonne "Compte"
      const accountRows = await Db.select<{ id: number; code: string; name: string }>(
        'SELECT id, code, name FROM accounts'
      );
      const byCode = new Map(accountRows.map((a) => [a.code.toUpperCase(), a.id]));
      const byName = new Map(accountRows.map((a) => [a.name.toUpperCase(), a.id]));
      const knownCategories = new Set(
        (await Db.select<{ code: string }>('SELECT code FROM categories')).map((c) => c.code)
      );

      for (const file of csvFiles) {
        onProgress?.(`Import de ${file.name}…`);
        const content = await tauriBridge.readExternalTextFile(joinAbs(dataDir, file.name));
        const parsed = Papa.parse<Comptal2CsvRow>(content, {
          header: true,
          delimiter: ';',
          skipEmptyLines: true,
        });

        // Compte du fichier : préfixe "{CODE}_" du nom, sinon colonne Compte
        const prefix = file.name.split('_')[0]?.toUpperCase() ?? '';
        let accountId = byCode.get(prefix) ?? null;

        const rows = parsed.data.filter((r) => r.Date);
        if (rows.length === 0) {
          Logger.warn('MigrationService.migrate', `Fichier vide ou illisible: ${file.name}`);
          continue;
        }

        if (accountId === null) {
          const compteValue = (rows[0].Compte ?? '').toUpperCase();
          accountId = byCode.get(compteValue) ?? byName.get(compteValue) ?? null;
        }
        if (accountId === null) {
          // Compte inconnu : on le crée à partir du préfixe du fichier
          const code = prefix || `CPT${byCode.size + 1}`;
          const created = await Db.execute(
            'INSERT OR IGNORE INTO accounts (code, name, color) VALUES (?, ?, ?)',
            [code, rows[0].Compte ?? code, '#4a90e2']
          );
          result.accountsCreated += created.rowsAffected;
          const found = await Db.select<{ id: number }>('SELECT id FROM accounts WHERE code = ?', [
            code,
          ]);
          accountId = found[0].id;
          byCode.set(code, accountId);
        }

        // Solde initial depuis le CSV si le compte n'en a pas
        const initialFromCsv = parseAmount(rows[0]['Solde initial']);
        if (initialFromCsv !== 0) {
          await Db.execute(
            'UPDATE accounts SET initial_balance = ? WHERE id = ? AND initial_balance = 0',
            [initialFromCsv, accountId]
          );
        }

        // Enregistrement d'import
        const dates = rows
          .map((r) => parseDateToIso(r.Date))
          .filter((d): d is string => d !== null)
          .sort();
        const importRes = await Db.execute(
          'INSERT INTO imports (filename, account_id, date_start, date_end, row_count) VALUES (?, ?, ?, ?, ?)',
          [file.name, accountId, dates[0] ?? null, dates[dates.length - 1] ?? null, rows.length]
        );
        const importId = importRes.lastInsertId ?? null;

        // Insertion des lignes par lots de 100 dans une transaction SQL
        await Db.inTransaction('MigrationService.migrate', async () => {
          const chunkSize = 100;
          for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            const placeholders: string[] = [];
            const params: unknown[] = [];
            for (const row of chunk) {
              const iso = parseDateToIso(row.Date);
              if (!iso) continue;
              const debitRaw = parseAmount(row['Débit']);
              const creditRaw = parseAmount(row['Crédit']);
              const categoryCode = (row['catégorie'] ?? '').trim() || null;
              if (categoryCode && !knownCategories.has(categoryCode)) {
                await Db.execute(
                  'INSERT OR IGNORE INTO categories (code, name, color) VALUES (?, ?, ?)',
                  [categoryCode, categoryCode, '#94a3b8']
                );
                knownCategories.add(categoryCode);
              }
              placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?)');
              params.push(
                accountId,
                iso,
                parseDateToIso(row['Date de valeur']),
                debitRaw > 0 ? -debitRaw : debitRaw,
                Math.abs(creditRaw),
                (row['Libellé'] ?? '').trim(),
                categoryCode,
                importId
              );
            }
            if (placeholders.length > 0) {
              await Db.execute(
                `INSERT INTO transactions (account_id, date, value_date, debit, credit, label, category_code, import_id)
                 VALUES ${placeholders.join(', ')}`,
                params
              );
              result.rowsImported += placeholders.length;
            }
          }
        });
        result.filesImported += 1;
      }

      Logger.info('MigrationService.migrate', 'Migration CSV terminée', result);

      onProgress?.('Migration facturation / association…');
      result.invoicingImported = await importInvoicingJson(parametreDir);

      const { AutoCategorisationService } = await import('./AutoCategorisationService');
      const statsCount = await AutoCategorisationService.rebuildFromTransactions();
      Logger.info('MigrationService.migrate', 'Stats auto-cat reconstruites', { statsCount });

      return result;
    }, { data: { sourceAbs } });
  },
};
