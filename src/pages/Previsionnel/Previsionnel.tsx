import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { addYears } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Category } from '../../types/models';
import {
  DEFAULT_SUBSCRIPTION_COLOR,
  Project,
  ProjectSubscription,
} from '../../types/projection';
import {
  ForecastComputed,
  ForecastWidgetLayout,
  DEFAULT_WIDGET_LAYOUT,
  ForecastColumnId,
  DEFAULT_COLUMN_WIDTHS,
} from '../../types/forecast';
import { ConfigService } from '../../services/ConfigService';
import { ProjectService } from '../../services/ProjectService';
import { computeForecast, ForecastGridRow, treeToGridRows, collectDescendantIds } from '../../services/ForecastModel';
import { Logger } from '../../services/logger';
import { Db } from '../../services/db';
import { parseAmount } from '../../utils/amounts';
import { toIsoDate } from '../../utils/dateFormats';
import ConfirmModal from '../../components/Common/ConfirmModal';
import Modal from '../../components/Common/Modal';
import PrevisionnelToolbar from '../../components/Previsionnel/PrevisionnelToolbar';
import PrevisionnelWidgetPanel from '../../components/Previsionnel/PrevisionnelWidgetPanel';
import PrevisionnelSplit from '../../components/Previsionnel/PrevisionnelSplit';
import ForecastGrid, { ForecastCellPatch } from '../../components/Previsionnel/ForecastGrid';
import FromCategoryDialog, { ForecastLineDraft } from '../../components/Previsionnel/FromCategoryDialog';
import FromTransactionDialog from '../../components/Previsionnel/FromTransactionDialog';
import '../../styles/previsionnel-custom.css';

function defaultRange(): { start: string; end: string } {
  const start = new Date();
  return { start: toIsoDate(start), end: toIsoDate(addYears(start, 1)) };
}

function insertParentId(row: ForecastGridRow | null | undefined): number | null {
  if (!row?.id) return row?.parentId ?? null;
  return row.isGroup ? row.id : row.parentId;
}

function resolveCategoryInput(raw: string, categories: Category[]): string | null {
  const q = raw.trim();
  if (!q) return null;
  const lower = q.toLowerCase();
  const byCode = categories.find((c) => c.code.toLowerCase() === lower);
  if (byCode) return byCode.code;
  const byName = categories.find((c) => c.name.toLowerCase() === lower);
  if (byName) return byName.code;
  const partial = categories.filter(
    (c) => c.code.toLowerCase().includes(lower) || c.name.toLowerCase().includes(lower)
  );
  if (partial.length === 1) return partial[0]!.code;
  return q;
}

const PrevisionnelPage: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projectId, setProjectId] = useState<number | ''>('');
  const [project, setProject] = useState<Project | null>(null);
  const [tree, setTree] = useState<ProjectSubscription[]>([]);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [initialBalance, setInitialBalance] = useState('0');
  const [layout, setLayout] = useState<ForecastWidgetLayout>(DEFAULT_WIDGET_LAYOUT);
  const [splitNonce, setSplitNonce] = useState(0);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fromCategoryOpen, setFromCategoryOpen] = useState(false);
  const [fromTransactionOpen, setFromTransactionOpen] = useState(false);
  const [dialogParentId, setDialogParentId] = useState<number | null>(null);
  const saveTimer = useRef<number | null>(null);

  const rows = useMemo(() => treeToGridRows(tree), [tree]);
  const selectedRow = useMemo(
    () => rows.find((r) => r.id !== null && r.id === selectedRowId) ?? null,
    [rows, selectedRowId]
  );

  const computed: ForecastComputed | null = useMemo(() => {
    if (!project) return null;
    return computeForecast(
      { ...project, startDate, endDate, initialBalance: parseAmount(initialBalance) },
      tree,
      categories,
      layout.chartGranularity
    );
  }, [project, startDate, endDate, initialBalance, tree, categories, layout.chartGranularity]);

  const loadList = useCallback(async (preferId?: number) => {
    const list = await ProjectService.list();
    setProjects(list);
    const nextId = preferId ?? list[0]?.id ?? '';
    setProjectId(nextId === undefined ? '' : nextId);
    return list;
  }, []);

  const loadProject = useCallback(async (id: number) => {
    const found = await ProjectService.get(id);
    if (!found) return;
    const nextTree = await ProjectService.listSubscriptionTree(id);
    setProject(found);
    setTree(nextTree);
    setName(found.name);
    setStartDate(found.startDate);
    setEndDate(found.endDate);
    setInitialBalance(String(found.initialBalance));
    setLayout(found.widgetLayout);
    setSelectedRowId(null);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [cats, list] = await Promise.all([ConfigService.listCategories(), ProjectService.list()]);
        setCategories(cats);
        setProjects(list);
        if (list[0]) {
          setProjectId(list[0].id);
          await loadProject(list[0].id);
        }
      } catch (err) {
        Logger.error('Previsionnel.load', err);
        toast.error(t('common.error'));
      } finally {
        setLoading(false);
      }
    })();
  }, [loadProject, t]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, []);

  const persistConfig = useCallback(
    (patch: Partial<Pick<Project, 'name' | 'startDate' | 'endDate' | 'initialBalance' | 'widgetLayout'>>) => {
      if (projectId === '') return;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      const profileAtStart = Db.profileId;
      const targetProjectId = projectId;
      saveTimer.current = window.setTimeout(() => {
        if (Db.profileId !== profileAtStart) return;
        void ProjectService.update(targetProjectId, patch).catch((err) => {
          Logger.error('Previsionnel.saveConfig', err);
          toast.error(t('common.error'));
        });
      }, 350);
    },
    [projectId, t]
  );

  const handleSelect = (id: number | '') => {
    setProjectId(id);
    if (id === '') {
      setProject(null);
      setTree([]);
      return;
    }
    void loadProject(id);
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      const range = defaultRange();
      const id = await ProjectService.create({
        name: trimmed,
        startDate: range.start,
        endDate: range.end,
        initialBalance: 0,
      });
      setCreateOpen(false);
      setNewName('');
      await loadList(id);
      await loadProject(id);
      toast.success(t('previsionnel.created'));
    } catch (err) {
      Logger.error('Previsionnel.create', err);
      toast.error(t('common.error'));
    }
  };

  const handleDeleteForecast = async () => {
    if (projectId === '') return;
    try {
      await ProjectService.remove(projectId);
      setConfirmDelete(false);
      const list = await loadList();
      if (list[0]) await loadProject(list[0].id);
      else {
        setProject(null);
        setTree([]);
        setProjectId('');
      }
      toast.success(t('previsionnel.deleted'));
    } catch (err) {
      Logger.error('Previsionnel.delete', err);
      toast.error(t('common.error'));
    }
  };

  const defaultSub = useCallback(
    (partial: Partial<ProjectSubscription>): Omit<ProjectSubscription, 'id' | 'children'> => ({
      projectId: Number(projectId),
      name: partial.name ?? t('previsionnel.newLine'),
      type: partial.type ?? 'debit',
      amount: partial.amount ?? 0,
      periodicity: partial.periodicity ?? 'monthly',
      startDate: partial.startDate ?? startDate,
      endDate: partial.endDate ?? null,
      categoryCode: partial.categoryCode ?? null,
      color: partial.color ?? DEFAULT_SUBSCRIPTION_COLOR,
      parentId: partial.parentId ?? null,
      isGroup: partial.isGroup ?? false,
      sortOrder: partial.sortOrder ?? tree.length,
    }),
    [projectId, startDate, t, tree.length]
  );

  const refreshTree = useCallback(async () => {
    if (projectId === '') return;
    const next = await ProjectService.listSubscriptionTree(projectId);
    setTree(next);
  }, [projectId]);

  const handleAddLine = async (parentId: number | null = insertParentId(selectedRow)) => {
    if (projectId === '') return;
    try {
      const id = await ProjectService.addSubscription(defaultSub({ parentId }));
      setSelectedRowId(id);
      await refreshTree();
    } catch (err) {
      Logger.error('Previsionnel.addLine', err);
      toast.error(t('common.error'));
    }
  };

  const handleAddGroup = async (parentId: number | null = insertParentId(selectedRow)) => {
    if (projectId === '') return;
    try {
      const id = await ProjectService.addSubscription(
        defaultSub({ name: t('previsionnel.newGroup'), isGroup: true, amount: 0, parentId })
      );
      setSelectedRowId(id);
      await refreshTree();
    } catch (err) {
      Logger.error('Previsionnel.addGroup', err);
      toast.error(t('common.error'));
    }
  };

  const handleDuplicate = async () => {
    if (!selectedRow?.id) {
      toast.info(t('previsionnel.selectRow'));
      return;
    }
    try {
      const id = await ProjectService.addSubscription(
        defaultSub({
          name: `${selectedRow.name} (copie)`,
          type: selectedRow.type,
          amount: selectedRow.amount,
          periodicity: selectedRow.periodicity,
          startDate: selectedRow.startDate || startDate,
          endDate: selectedRow.endDate || null,
          categoryCode: selectedRow.categoryCode || null,
          color: selectedRow.color,
          parentId: selectedRow.parentId,
          isGroup: selectedRow.isGroup,
        })
      );
      setSelectedRowId(id);
      await refreshTree();
    } catch (err) {
      Logger.error('Previsionnel.duplicate', err);
      toast.error(t('common.error'));
    }
  };

  const handleDeleteRow = async () => {
    if (!selectedRow?.id) {
      toast.info(t('previsionnel.selectRow'));
      return;
    }
    try {
      await ProjectService.removeSubscription(selectedRow.id);
      setSelectedRowId(null);
      await refreshTree();
    } catch (err) {
      Logger.error('Previsionnel.deleteRow', err);
      toast.error(t('common.error'));
    }
  };

  const handlePatch = async (rowIndex: number, patch: ForecastCellPatch) => {
    if (projectId === '') return;
    const row = rows[rowIndex];
    if (!row) return;
    if (!row.id && Object.keys(patch).length === 1 && patch.name === '') return;
    try {
      let parentId = row.parentId;
      if (patch.groupName !== undefined) {
        const wanted = patch.groupName.trim();
        if (!wanted) {
          parentId = null;
        } else {
          const match = rows.find(
            (r) => r.isGroup && r.id && r.name.toLowerCase() === wanted.toLowerCase() && r.id !== row.id
          );
          if (match?.id) {
            if (row.id && row.isGroup && collectDescendantIds(tree, row.id).has(match.id)) {
              toast.warn(t('previsionnel.invalidGroup'));
              return;
            }
            parentId = match.id;
          } else {
            parentId = await ProjectService.addSubscription(
              defaultSub({ name: wanted, isGroup: true, amount: 0 })
            );
          }
        }
      }

      const categoryCode =
        patch.categoryCode !== undefined
          ? resolveCategoryInput(patch.categoryCode, categories)
          : undefined;

      if (row.id) {
        const fields: Parameters<typeof ProjectService.updateSubscription>[1] = {};
        if (patch.name !== undefined && patch.name.trim()) fields.name = patch.name.trim();
        if (patch.type !== undefined) fields.type = patch.type;
        if (patch.amount !== undefined && !row.isGroup) fields.amount = patch.amount;
        if (patch.periodicity !== undefined) fields.periodicity = patch.periodicity;
        if (patch.startDate !== undefined) fields.startDate = patch.startDate || startDate;
        if (patch.endDate !== undefined) fields.endDate = patch.endDate || null;
        if (categoryCode !== undefined) fields.categoryCode = categoryCode;
        if (patch.color !== undefined) fields.color = patch.color;
        if (patch.groupName !== undefined) fields.parentId = parentId;
        if (Object.keys(fields).length === 0) return;
        await ProjectService.updateSubscription(row.id, fields);
      } else {
        const nameValue = (patch.name ?? row.name).trim() || t('previsionnel.newLine');
        const id = await ProjectService.addSubscription(
          defaultSub({
            name: nameValue,
            type: patch.type ?? row.type,
            amount: patch.amount ?? row.amount,
            periodicity: patch.periodicity ?? row.periodicity,
            startDate: patch.startDate || row.startDate || startDate,
            endDate: patch.endDate || row.endDate || null,
            categoryCode: categoryCode !== undefined ? categoryCode : row.categoryCode || null,
            color: patch.color ?? row.color,
            parentId,
            isGroup: row.isGroup,
          })
        );
        setSelectedRowId(id);
      }
      await refreshTree();
    } catch (err) {
      Logger.error('Previsionnel.patchCell', err);
      toast.error(t('common.error'));
    }
  };

  const handleLayoutChange = (next: ForecastWidgetLayout) => {
    setLayout(next);
    persistConfig({ widgetLayout: next });
  };

  const handleColumnsChange = (columns: ForecastColumnId[]) => {
    handleLayoutChange({ ...layout, columns });
  };

  const handleColumnWidthsChange = (columnWidths: Partial<Record<ForecastColumnId, number>>) => {
    handleLayoutChange({ ...layout, columnWidths: { ...DEFAULT_COLUMN_WIDTHS, ...columnWidths } });
  };

  const openFromCategory = (parentId: number | null) => {
    setDialogParentId(parentId);
    setFromCategoryOpen(true);
  };

  const openFromTransaction = (parentId: number | null) => {
    setDialogParentId(parentId);
    setFromTransactionOpen(true);
  };

  const handleDraftLine = async (draft: ForecastLineDraft) => {
    if (projectId === '') return;
    try {
      const id = await ProjectService.addSubscription(
        defaultSub({
          name: draft.name,
          type: draft.type,
          amount: draft.amount,
          periodicity: draft.periodicity,
          categoryCode: draft.categoryCode,
          color: draft.color,
          parentId: dialogParentId,
        })
      );
      setSelectedRowId(id);
      await refreshTree();
    } catch (err) {
      Logger.error('Previsionnel.addFromDialog', err);
      toast.error(t('common.error'));
    }
  };

  if (loading) {
    return (
      <div className="previsionnel-loading">
        <Loader2 className="animate-spin" /> {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="previsionnel-page">
      <header className="previsionnel-header">
        <h1 data-tour="page-intro-anchor">{t('previsionnel.title')}</h1>
        <p>{t('previsionnel.subtitle')}</p>
      </header>

      <PrevisionnelToolbar
        projects={projects}
        projectId={projectId}
        name={name}
        startDate={startDate}
        endDate={endDate}
        initialBalance={initialBalance}
        onSelectProject={handleSelect}
        onNameChange={(value) => {
          setName(value);
          persistConfig({ name: value });
        }}
        onStartDateChange={(value) => {
          setStartDate(value);
          persistConfig({ startDate: value });
        }}
        onEndDateChange={(value) => {
          setEndDate(value);
          persistConfig({ endDate: value });
        }}
        onBalanceChange={(value) => {
          setInitialBalance(value);
          persistConfig({ initialBalance: parseAmount(value) });
        }}
        onCreate={() => {
          setNewName('');
          setCreateOpen(true);
        }}
        onDelete={() => setConfirmDelete(true)}
        onAddLine={() => void handleAddLine()}
        onAddGroup={() => void handleAddGroup()}
        onDuplicate={() => void handleDuplicate()}
        onDeleteRow={() => void handleDeleteRow()}
      />

      <PrevisionnelSplit
        ratio={layout.splitRatio}
        onRatioChange={(splitRatio) => setLayout((prev) => ({ ...prev, splitRatio }))}
        onRatioCommit={(splitRatio) => {
          setSplitNonce((n) => n + 1);
          persistConfig({ widgetLayout: { ...layout, splitRatio } });
        }}
        left={
          <section className="previsionnel-table-pane">
            <div className="previsionnel-table-label">{t('previsionnel.tableTitle')}</div>
            {projectId === '' ? (
              <div className="previsionnel-empty">{t('previsionnel.emptyHint')}</div>
            ) : (
              <ForecastGrid
                rows={rows}
                columns={layout.columns}
                columnWidths={layout.columnWidths}
                categories={categories}
                selectedRowId={selectedRowId}
                onSelectRow={(id) => setSelectedRowId(id)}
                onPatch={(rowIndex, patch) => void handlePatch(rowIndex, patch)}
                onColumnsChange={handleColumnsChange}
                onColumnWidthsChange={handleColumnWidthsChange}
                onAddLine={(parentId) => void handleAddLine(parentId)}
                onAddGroup={(parentId) => void handleAddGroup(parentId)}
                onFromCategory={openFromCategory}
                onFromTransaction={openFromTransaction}
              />
            )}
          </section>
        }
        right={
          <PrevisionnelWidgetPanel
            layout={layout}
            computed={computed}
            customizeOpen={customizeOpen}
            splitNonce={splitNonce}
            onToggleCustomize={() => setCustomizeOpen((v) => !v)}
            onChangeLayout={handleLayoutChange}
          />
        }
      />

      <Modal
        isOpen={createOpen}
        title={t('previsionnel.newForecast')}
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button type="button" className="ct-btn-secondary" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="ct-btn-primary" onClick={() => void handleCreate()}>
              {t('common.add')}
            </button>
          </>
        }
      >
        <label className="previsionnel-field">
          <span>{t('common.name')}</span>
          <input
            className="ct-input w-full"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate();
            }}
          />
        </label>
      </Modal>

      <FromCategoryDialog
        isOpen={fromCategoryOpen}
        categories={categories}
        onClose={() => setFromCategoryOpen(false)}
        onValidate={(draft) => void handleDraftLine(draft)}
      />
      <FromTransactionDialog
        isOpen={fromTransactionOpen}
        categories={categories}
        onClose={() => setFromTransactionOpen(false)}
        onValidate={(draft) => void handleDraftLine(draft)}
      />

      <ConfirmModal
        isOpen={confirmDelete}
        title={t('previsionnel.deleteForecast')}
        message={t('previsionnel.deleteForecastConfirm')}
        onConfirm={() => void handleDeleteForecast()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
};

export default PrevisionnelPage;
