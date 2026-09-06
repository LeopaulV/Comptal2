import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  Plus,
  HelpCircle,
  SkipForward,
} from 'lucide-react';
import { Account } from '../../types/models';
import {
  ColumnMappingConfig,
  ColumnRole,
  ExcelSheetInfo,
  FileAnalysisResult,
  ImportTemplate,
  OverlapWarning,
  PreviewRow,
} from '../../types/import';
import { ConfigService } from '../../services/ConfigService';
import { FileDetectionService } from '../../services/FileDetectionService';
import {
  ColumnMappingService,
  isImportableStructure,
} from '../../services/ColumnMappingService';
import { ImportService, transformRows } from '../../services/ImportService';
import { ImportTemplateService } from '../../services/ImportTemplateService';
import { Logger } from '../../services/logger';
import { parseAmount } from '../../utils/amounts';
import FileDropzone from '../../components/Upload/FileDropzone';
import ExcelSheetSelector from '../../components/Upload/ExcelSheetSelector';
import ColumnMappingInterface from '../../components/Upload/ColumnMappingInterface';
import ImportPreviewTable from '../../components/Upload/ImportPreviewTable';
import ManualDataCreator from '../../components/Upload/ManualDataCreator';
import CreateAccountModal from '../../components/Upload/CreateAccountModal';
import ImportHelpModal from '../../components/Upload/ImportHelpModal';
import SaveTemplateModal from '../../components/Upload/SaveTemplateModal';
import TemplatePicker from '../../components/Upload/TemplatePicker';
import UploadStepper, { UploadStepKey } from '../../components/Upload/UploadStepper';
import ConfirmModal from '../../components/Common/ConfirmModal';

type Step = UploadStepKey;

const UploadPage: React.FC = () => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('select');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<ExcelSheetInfo[]>([]);
  const [sheetAssignment, setSheetAssignment] = useState<Record<string, number>>({});
  const [currentSheet, setCurrentSheet] = useState<string | undefined>();
  const [analysis, setAnalysis] = useState<FileAnalysisResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMappingConfig | null>(null);
  const [lastRoles, setLastRoles] = useState<Map<number, ColumnRole> | null>(null);
  const [accountId, setAccountId] = useState<number | ''>('');
  const [initialBalance, setInitialBalance] = useState('0');
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [overlap, setOverlap] = useState<OverlapWarning[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [pendingTemplateApply, setPendingTemplateApply] = useState(false);
  const [skippedItems, setSkippedItems] = useState<string[]>([]);
  const [failedItem, setFailedItem] = useState<string | null>(null);
  const [remainingCount, setRemainingCount] = useState(0);
  const excelRemainingRef = useRef<string[]>([]);
  const importedTotalRef = useRef(0);
  const skippedRef = useRef<string[]>([]);
  const sheetAssignmentRef = useRef<Record<string, number>>({});

  const reloadAccounts = useCallback(async () => {
    try {
      setAccounts(await ConfigService.listAccounts());
    } catch (err) {
      Logger.error('Upload.reloadAccounts', err);
    }
  }, []);

  const reloadTemplates = useCallback(async () => {
    try {
      setTemplates(await ImportTemplateService.list());
    } catch (err) {
      Logger.error('Upload.reloadTemplates', err);
    }
  }, []);

  useEffect(() => {
    void reloadAccounts();
    void reloadTemplates();
  }, [reloadAccounts, reloadTemplates]);

  const reset = () => {
    setStep('select');
    setFile(null);
    setSheets([]);
    setSheetAssignment({});
    sheetAssignmentRef.current = {};
    setCurrentSheet(undefined);
    setAnalysis(null);
    setMapping(null);
    setLastRoles(null);
    setAccountId('');
    setInitialBalance('0');
    setPreview([]);
    setOverlap(null);
    setErrors([]);
    setImportedCount(0);
    setSelectedTemplateId('');
    setPendingTemplateApply(false);
    setBusy(false);
    setSkippedItems([]);
    setFailedItem(null);
    setRemainingCount(0);
    excelRemainingRef.current = [];
    importedTotalRef.current = 0;
    skippedRef.current = [];
  };

  const applyTemplateMeta = (tpl: ImportTemplate) => {
    if (tpl.accountId != null) {
      setAccountId(tpl.accountId);
      const acc = accounts.find((a) => a.id === tpl.accountId);
      if (tpl.initialBalance != null) setInitialBalance(String(tpl.initialBalance));
      else if (acc) setInitialBalance(String(acc.initialBalance));
    } else if (tpl.initialBalance != null) {
      setInitialBalance(String(tpl.initialBalance));
    }
  };

  const setRemainingQueue = (next: string[]) => {
    excelRemainingRef.current = next;
    setRemainingCount(next.length);
  };

  const presentItemError = (messages: string[], itemName: string) => {
    setErrors(messages);
    setFailedItem(itemName);
    setBusy(false);
    setStep('error');
  };

  const finishExcelQueue = () => {
    setSkippedItems([...skippedRef.current]);
    setImportedCount(importedTotalRef.current);
    setFailedItem(null);
    if (importedTotalRef.current > 0) {
      setStep('success');
      return;
    }
    toast.info(t('upload.nothingImported'));
    reset();
  };

  const skipAndContinue = async (target: File, failedName: string, reason: string) => {
    const startedAt = Logger.start('Upload.skipUnusable', reason, { name: failedName });
    skippedRef.current = [...skippedRef.current, failedName];
    setSkippedItems([...skippedRef.current]);
    Logger.warn('Upload.skipUnusable', reason, { name: failedName });
    toast.warn(reason);
    const remaining = excelRemainingRef.current;
    if (remaining.length === 0) {
      finishExcelQueue();
      Logger.end('Upload.skipUnusable', startedAt);
      return;
    }
    const next = remaining[0];
    setRemainingQueue(remaining.slice(1));
    setCurrentSheet(next);
    setPreview([]);
    setMapping(null);
    setAnalysis(null);
    setFailedItem(null);
    setErrors([]);
    await analyzeAndMap(target, next, sheetAssignmentRef.current[next]);
    Logger.end('Upload.skipUnusable', startedAt);
  };

  const handleIgnoreImport = async () => {
    const itemName = failedItem ?? currentSheet ?? file?.name ?? '';
    if (!file) {
      reset();
      return;
    }
    await skipAndContinue(file, itemName, t('upload.skippedIgnored', { name: itemName }));
  };

  const analyzeAndMap = async (target: File, sheetName?: string, assignedAccount?: number) => {
    setBusy(true);
    setStep('analyzing');
    const itemName = sheetName ?? target.name;
    let errorMessages: string[] | null = null;
    try {
      const structure = await FileDetectionService.analyzeFile(target, sheetName);
      if (!isImportableStructure(structure)) {
        errorMessages = [t('upload.emptyTable', { name: itemName })];
      } else {
        const result = ColumnMappingService.analyzeFile(structure);
        setAnalysis(result);

        let tplId: number | '' = selectedTemplateId;
        if (!tplId) {
          const matched = await ImportTemplateService.findMatching(
            structure.columns.map((c) => c.name)
          );
          if (matched) {
            tplId = matched.id;
            setSelectedTemplateId(matched.id);
            applyTemplateMeta(matched);
            toast.info(t('upload.templates.autoApplied', { name: matched.name }));
          }
        } else {
          const tpl = templates.find((x) => x.id === tplId);
          if (tpl) applyTemplateMeta(tpl);
        }

        if (assignedAccount) {
          setAccountId(assignedAccount);
          const acc = accounts.find((a) => a.id === assignedAccount);
          if (acc && !pendingTemplateApply) setInitialBalance(String(acc.initialBalance));
        }

        setPendingTemplateApply(false);
        setFailedItem(null);
        setStep('mapping');
      }
    } catch (err) {
      Logger.error('Upload.analyzeAndMap', err);
      const msg = err instanceof Error ? err.message : '';
      errorMessages = [
        /vide/i.test(msg)
          ? t('upload.emptyTable', { name: itemName })
          : t('upload.analyzeItemError', { name: itemName }),
      ];
    } finally {
      setBusy(false);
    }

    if (errorMessages) {
      presentItemError(errorMessages, itemName);
    }
  };

  const handleFiles = async (files: File[]) => {
    const first = files[0];
    if (!first) return;
    setFile(first);
    setErrors([]);
    const type = FileDetectionService.detectFileType(first.name);
    if (type === 'excel') {
      setBusy(true);
      setStep('sheets');
      try {
        const listed = await FileDetectionService.listSheets(first);
        setSheets(listed);
      } catch (err) {
        Logger.error('Upload.handleFiles', err);
        setFailedItem(first.name);
        setErrors([t('upload.analyzeError')]);
        setStep('error');
      } finally {
        setBusy(false);
      }
      return;
    }
    setStep('config');
  };

  const handleConfigContinue = async () => {
    if (accountId === '' || !file) {
      toast.error(t('upload.needAccount'));
      return;
    }
    await analyzeAndMap(file, undefined, accountId);
  };

  const startExcelImport = async () => {
    const assigned = sheets.filter((s) => sheetAssignment[s.name]).map((s) => s.name);
    if (assigned.length === 0 || !file) {
      toast.error(t('upload.needSheetAccount'));
      return;
    }
    sheetAssignmentRef.current = sheetAssignment;
    setRemainingQueue(assigned.slice(1));
    importedTotalRef.current = 0;
    skippedRef.current = [];
    setSkippedItems([]);
    setImportedCount(0);
    setCurrentSheet(assigned[0]);
    await analyzeAndMap(file, assigned[0], sheetAssignment[assigned[0]]);
  };

  const onMappingConfirm = (nextMapping: ColumnMappingConfig, roles: Map<number, ColumnRole>) => {
    if (!analysis) return;
    const rows = transformRows(analysis.structure, nextMapping);
    if (rows.length === 0) {
      const itemName = currentSheet ?? file?.name ?? '';
      presentItemError([t('upload.noRows')], itemName);
      return;
    }
    setMapping(nextMapping);
    setLastRoles(roles);
    setPreview(rows);
    setStep('preview');
  };

  const doImport = async () => {
    if (accountId === '' || preview.length === 0) {
      toast.error(t('upload.needAccount'));
      return;
    }
    const dates = preview.map((r) => r.date).sort();
    const overlaps = await ImportService.findOverlaps(accountId, dates[0], dates[dates.length - 1]);
    if (overlaps.length > 0 && overlap === null) {
      setOverlap(overlaps);
      return;
    }
    setOverlap(null);
    setBusy(true);
    setStep('uploading');
    const itemName = currentSheet ?? file?.name ?? 'manuel.csv';
    let continued = false;
    try {
      const filename = currentSheet
        ? `${file?.name ?? 'excel'} / ${currentSheet}`
        : file?.name ?? 'manuel.csv';
      const result = await ImportService.importRows({
        accountId,
        filename,
        rows: preview,
        initialBalance: parseAmount(initialBalance),
      });
      importedTotalRef.current += result.imported;
      setImportedCount(importedTotalRef.current);
      const remaining = excelRemainingRef.current;
      if (remaining.length > 0 && file) {
        const next = remaining[0];
        setRemainingQueue(remaining.slice(1));
        setCurrentSheet(next);
        setPreview([]);
        setMapping(null);
        toast.success(t('upload.imported', { count: result.imported }));
        continued = true;
        await analyzeAndMap(file, next, sheetAssignmentRef.current[next]);
      } else {
        setSkippedItems([...skippedRef.current]);
        setStep('success');
      }
    } catch (err) {
      Logger.error('Upload.doImport', err);
      presentItemError([t('common.error')], itemName);
    } finally {
      if (!continued) setBusy(false);
    }
  };

  const handleCreateAccount = async (input: {
    code: string;
    name: string;
    color: string;
    initialBalance: number;
  }) => {
    try {
      await ConfigService.createAccount(input);
      await reloadAccounts();
      const list = await ConfigService.listAccounts();
      const created = list.find((a) => a.code === input.code);
      if (created) {
        setAccountId(created.id);
        setInitialBalance(String(created.initialBalance));
      }
      setCreateOpen(false);
      toast.success(t('common.success'));
    } catch (err) {
      Logger.error('Upload.handleCreateAccount', err);
      toast.error(t('common.error'));
    }
  };

  const handleSaveTemplate = async (name: string) => {
    if (!analysis || !lastRoles) {
      // Sauver depuis mapping : lastRoles peut être passé via saveTplOpen state
      toast.error(t('common.error'));
      setSaveTplOpen(false);
      return;
    }
    try {
      await ImportTemplateService.create({
        name,
        accountId: accountId === '' ? null : accountId,
        initialBalance: parseAmount(initialBalance),
        columnRoles: ImportTemplateService.rolesToHeaders(lastRoles, analysis.structure.columns),
      });
      await reloadTemplates();
      setSaveTplOpen(false);
      toast.success(t('upload.templates.saved'));
    } catch (err) {
      Logger.error('Upload.handleSaveTemplate', err);
      toast.error(t('common.error'));
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    try {
      await ImportTemplateService.remove(id);
      if (selectedTemplateId === id) setSelectedTemplateId('');
      await reloadTemplates();
      toast.success(t('common.success'));
    } catch (err) {
      Logger.error('Upload.handleDeleteTemplate', err);
      toast.error(t('common.error'));
    }
  };

  const onSelectTemplateFromSelect = (id: number | '') => {
    setSelectedTemplateId(id);
    if (id === '') return;
    const tpl = templates.find((x) => x.id === id);
    if (tpl) {
      applyTemplateMeta(tpl);
      setPendingTemplateApply(true);
    }
  };

  return (
    <div className="upload-page space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--invoicing-gray-900)' }}>
          {t('upload.title')}
        </h1>
        <p className="mt-1" style={{ color: 'var(--invoicing-gray-500)' }}>
          {t('upload.subtitle')}
        </p>
      </div>

      <UploadStepper step={step} />

      {step === 'select' && (
        <div className="space-y-4">
          <TemplatePicker
            templates={templates}
            selectedId={selectedTemplateId}
            onSelect={onSelectTemplateFromSelect}
            onDelete={(id) => void handleDeleteTemplate(id)}
          />
          <div className="ct-card">
            <FileDropzone onFiles={(files) => void handleFiles(files)} />
          </div>
          <div className="upload-or-divider text-sm" style={{ color: 'var(--invoicing-gray-500)' }}>
            <span>{t('common.or')}</span>
          </div>
          <div className="ct-card text-center py-8">
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--invoicing-gray-900)' }}>
              {t('upload.manualCreateTitle')}
            </h3>
            <p className="ct-hint mb-6">{t('upload.manualCreateDesc')}</p>
            <button className="ct-btn-primary" onClick={() => setStep('manual')}>
              {t('upload.manual')}
            </button>
          </div>
          <div className="upload-info-banner">
            <h4 className="font-semibold mb-1">{t('upload.supportedFormats')}</h4>
            <p className="text-sm opacity-90 mb-2">{t('upload.supportedFormatsDesc')}</p>
            <p className="text-xs opacity-80">{t('upload.acceptedFormats')}</p>
            <button
              type="button"
              className="mt-3 text-sm font-medium underline inline-flex items-center gap-1"
              onClick={() => setHelpOpen(true)}
            >
              <HelpCircle size={14} />
              {t('upload.importHelp.link')}
            </button>
          </div>
        </div>
      )}

      {step === 'config' && (
        <div className="ct-card space-y-6">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--invoicing-gray-900)' }}>
              {t('upload.selectAccount')}
            </h3>
            <p className="ct-hint">{t('upload.selectAccountDesc')}</p>
          </div>
          <div className="flex gap-2 flex-wrap items-end">
            <label className="ct-label flex-1 min-w-[200px]">
              {t('upload.account')}
              <select
                className="ct-select w-full mt-1"
                value={accountId}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setAccountId(id);
                  const acc = accounts.find((a) => a.id === id);
                  if (acc) setInitialBalance(String(acc.initialBalance));
                }}
              >
                <option value="">{t('upload.chooseAccount')}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="ct-btn-secondary" onClick={() => setCreateOpen(true)}>
              <Plus size={16} />
              {t('upload.createAccount')}
            </button>
          </div>
          <div
            className="flex justify-end gap-3 pt-4"
            style={{ borderTop: '1px solid var(--invoicing-gray-200)' }}
          >
            <button className="ct-btn-secondary" onClick={reset}>
              {t('common.cancel')}
            </button>
            <button
              className="ct-btn-primary"
              disabled={accountId === '' || busy}
              onClick={() => void handleConfigContinue()}
            >
              {t('upload.analyzeFile')}
            </button>
          </div>
        </div>
      )}

      {step === 'sheets' && (
        <>
          {busy ? (
            <div className="ct-card text-center py-12">
              <Loader2 className="animate-spin mx-auto mb-4" size={48} style={{ color: 'var(--invoicing-primary)' }} />
              <p className="text-lg font-semibold">{t('upload.analyzingSheets')}</p>
            </div>
          ) : (
            <>
              <ExcelSheetSelector
                sheets={sheets}
                accounts={accounts}
                assignment={sheetAssignment}
                onAssign={(name, id) =>
                  setSheetAssignment((prev) => {
                    const next = { ...prev, [name]: id };
                    sheetAssignmentRef.current = next;
                    return next;
                  })
                }
              />
              <div className="flex gap-3 justify-end">
                <button className="ct-btn-secondary" onClick={() => setCreateOpen(true)}>
                  <Plus size={16} />
                  {t('upload.createAccount')}
                </button>
                <button className="ct-btn-secondary" onClick={reset}>
                  {t('common.cancel')}
                </button>
                <button className="ct-btn-primary" onClick={() => void startExcelImport()}>
                  {t('upload.continue')}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {step === 'analyzing' && (
        <div className="ct-card text-center py-12">
          <Loader2 className="animate-spin mx-auto mb-4" size={48} style={{ color: 'var(--invoicing-primary)' }} />
          <p className="text-lg font-semibold" style={{ color: 'var(--invoicing-gray-900)' }}>
            {currentSheet
              ? t('upload.analyzingSheet', { sheetName: currentSheet })
              : t('upload.analyzingFile')}
          </p>
          <p className="ct-hint mt-2">{t('upload.detectingStructure')}</p>
        </div>
      )}

      {step === 'mapping' && analysis && (
        <ColumnMappingInterface
          structure={analysis.structure}
          detectedColumns={analysis.detectedColumns}
          initialBalance={initialBalance}
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          onChangeBalance={setInitialBalance}
          onSelectTemplate={onSelectTemplateFromSelect}
          onConfirm={onMappingConfirm}
          onSaveTemplate={(roles) => {
            setLastRoles(roles);
            setSaveTplOpen(true);
          }}
          onBack={() => (currentSheet ? setStep('sheets') : setStep('config'))}
          onIgnore={() => void handleIgnoreImport()}
          ignoreHint={
            remainingCount > 0
              ? t('upload.ignoreThisImportHint', { count: remainingCount })
              : importedCount > 0
                ? t('upload.ignoreThisImportKeep')
                : undefined
          }
        />
      )}

      {step === 'manual' && (
        <ManualDataCreator
          onReady={(rows) => {
            setPreview(rows);
            setStep('preview');
          }}
        />
      )}

      {step === 'preview' && (
        <>
          {accountId === '' && (
            <div className="ct-card">
              <label className="ct-label max-w-sm">
                {t('upload.account')}
                <select
                  className="ct-select w-full mt-1"
                  value={accountId}
                  onChange={(e) => setAccountId(Number(e.target.value))}
                >
                  <option value="">{t('upload.chooseAccount')}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <ImportPreviewTable
            rows={preview}
            busy={busy}
            onCancel={() => setStep(mapping ? 'mapping' : 'manual')}
            onIgnore={() => void handleIgnoreImport()}
            onConfirm={() => void doImport()}
            confirmLabel={t('upload.importTransactions', { count: preview.length })}
            ignoreHint={
              remainingCount > 0
                ? t('upload.ignoreThisImportHint', { count: remainingCount })
                : importedCount > 0
                  ? t('upload.ignoreThisImportKeep')
                  : undefined
            }
          />
        </>
      )}

      {step === 'uploading' && (
        <div className="ct-card text-center py-12">
          <Loader2 className="animate-spin mx-auto mb-4" size={48} style={{ color: 'var(--invoicing-primary)' }} />
          <p className="text-lg font-semibold">{t('upload.importing')}</p>
        </div>
      )}

      {step === 'success' && (
        <div className="ct-card text-center py-12">
          <div className="upload-status-icon success">
            <CheckCircle size={32} />
          </div>
          <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--invoicing-gray-900)' }}>
            {t('upload.importSuccess')}
          </h3>
          <p style={{ color: 'var(--invoicing-gray-500)' }}>
            {t('upload.importSuccessCSV', { count: importedCount })}
          </p>
          {skippedItems.length > 0 && (
            <p className="text-sm mt-3" style={{ color: 'var(--invoicing-gray-500)' }}>
              {t('upload.skippedSummary', { items: skippedItems.join(', ') })}
            </p>
          )}
          <button className="ct-btn-primary mt-6" onClick={reset}>
            {t('upload.restart')}
          </button>
        </div>
      )}

      {step === 'error' && (
        <div className="ct-card text-center py-12">
          <div className="upload-status-icon error">
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--invoicing-gray-900)' }}>
            {t('upload.importError')}
          </h3>
          {failedItem && (
            <p className="text-sm mb-3" style={{ color: 'var(--invoicing-gray-500)' }}>
              {t('upload.failedItem', { name: failedItem })}
            </p>
          )}
          <div className="text-left max-w-md mx-auto mb-6">
            {errors.map((error) => (
              <p key={error} className="text-sm" style={{ color: 'var(--invoicing-danger)' }}>
                • {error}
              </p>
            ))}
          </div>
          {(remainingCount > 0 || importedCount > 0) && (
            <p className="ct-hint max-w-md mx-auto mb-6">
              {remainingCount > 0
                ? t('upload.ignoreThisImportHint', { count: remainingCount })
                : t('upload.ignoreThisImportKeep')}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            <button className="ct-btn-secondary" onClick={reset}>
              {t('upload.retry')}
            </button>
            <button
              className="ct-btn-primary"
              disabled={busy}
              onClick={() => void handleIgnoreImport()}
            >
              <SkipForward size={16} />
              {t('upload.ignoreThisImport')}
            </button>
          </div>
        </div>
      )}

      <CreateAccountModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(input) => void handleCreateAccount(input)}
      />
      <ImportHelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      <SaveTemplateModal
        isOpen={saveTplOpen}
        defaultName={file?.name?.replace(/\.[^.]+$/, '') ?? ''}
        onClose={() => setSaveTplOpen(false)}
        onSave={(name) => void handleSaveTemplate(name)}
      />
      <ConfirmModal
        isOpen={overlap !== null && overlap.length > 0}
        title={t('upload.overlapTitle')}
        message={t('upload.overlapMessage', {
          files: overlap?.map((o) => o.filename).join(', ') ?? '',
        })}
        confirmLabel={t('upload.importAnyway')}
        danger={false}
        onCancel={() => setOverlap(null)}
        onConfirm={() => {
          setOverlap([]);
          void doImport();
        }}
      />
    </div>
  );
};

export default UploadPage;
