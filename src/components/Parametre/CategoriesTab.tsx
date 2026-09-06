import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2, Check, X, Palette, FolderPlus } from 'lucide-react';
import { Category, CategoryGroup } from '../../types/models';
import { PaletteApplication } from '../../types/colorPalette';
import { ConfigService } from '../../services/ConfigService';
import { Logger } from '../../services/logger';
import ConfirmModal from '../Common/ConfirmModal';
import { CategorySwatch, CategoryXInfo } from '../Common/CategoryX';
import PalettePreviewModal from './PalettePreviewModal';
import { isTransferCategory } from '../../utils/categories';

interface EditState {
  code: string;
  name: string;
  color: string;
  groupId: number | null;
}

const EMPTY: EditState = { code: '', name: '', color: '#94a3b8', groupId: null };

function parseGroupId(value: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const CategoriesTab: React.FC = () => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditState>(EMPTY);
  const [draft, setDraft] = useState<EditState>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [paletteNets, setPaletteNets] = useState<Record<string, number>>({});
  const [groupDraft, setGroupDraft] = useState({ name: '', color: '#64748b' });
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editGroup, setEditGroup] = useState({ name: '', color: '#64748b' });
  const [deleteGroup, setDeleteGroup] = useState<CategoryGroup | null>(null);

  const reload = useCallback(async () => {
    try {
      const [cats, loadedGroups] = await Promise.all([
        ConfigService.listCategories(),
        ConfigService.listCategoryGroups(),
      ]);
      setCategories(cats);
      setGroups(loadedGroups);
    } catch (err) {
      Logger.error('CategoriesTab.reload', err);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!showPalette) return;
    void ConfigService.categoryNets()
      .then(setPaletteNets)
      .catch((err) => Logger.error('CategoriesTab.paletteNets', err));
  }, [showPalette]);

  const handleAdd = async () => {
    if (!draft.code.trim() || !draft.name.trim()) return;
    try {
      await ConfigService.createCategory({
        code: draft.code.toUpperCase(),
        name: draft.name,
        color: draft.color,
        groupId: draft.groupId,
      });
      setDraft(EMPTY);
      await reload();
      toast.success(t('common.success'));
    } catch (err) {
      Logger.error('CategoriesTab.handleAdd', err);
      toast.error(t('common.error'));
    }
  };

  const handleSaveEdit = async (id: number) => {
    try {
      await ConfigService.updateCategory(id, {
        code: edit.code.toUpperCase(),
        name: edit.name,
        color: edit.color,
        groupId: edit.groupId,
      });
      setEditingId(null);
      await reload();
    } catch (err) {
      Logger.error('CategoriesTab.handleSaveEdit', err);
      toast.error(t('common.error'));
    }
  };

  const handleAssignGroup = async (category: Category, groupId: number | null) => {
    try {
      await ConfigService.updateCategory(category.id, { groupId });
      await reload();
    } catch (err) {
      Logger.error('CategoriesTab.handleAssignGroup', err);
      toast.error(t('common.error'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await ConfigService.deleteCategory(deleteTarget.id);
      setDeleteTarget(null);
      await reload();
      toast.success(t('common.success'));
    } catch (err) {
      Logger.error('CategoriesTab.handleDelete', err);
      toast.error(t('common.error'));
    }
  };

  const handleAddGroup = async () => {
    if (!groupDraft.name.trim()) {
      toast.warn(t('settings.categories.groupNameRequired'));
      return;
    }
    try {
      await ConfigService.createCategoryGroup({
        name: groupDraft.name.trim(),
        color: groupDraft.color,
      });
      setGroupDraft({ name: '', color: '#64748b' });
      await reload();
      toast.success(t('common.success'));
    } catch (err) {
      Logger.error('CategoriesTab.handleAddGroup', err);
      toast.error(t('common.error'));
    }
  };

  const handleSaveGroup = async (id: number) => {
    if (!editGroup.name.trim()) {
      toast.warn(t('settings.categories.groupNameRequired'));
      return;
    }
    try {
      await ConfigService.updateCategoryGroup(id, {
        name: editGroup.name.trim(),
        color: editGroup.color,
      });
      setEditingGroupId(null);
      await reload();
      toast.success(t('common.success'));
    } catch (err) {
      Logger.error('CategoriesTab.handleSaveGroup', err);
      toast.error(t('common.error'));
    }
  };

  const handleToggleMember = async (groupId: number, category: Category, checked: boolean) => {
    try {
      await ConfigService.updateCategory(category.id, {
        groupId: checked ? groupId : category.groupId === groupId ? null : category.groupId,
      });
      await reload();
    } catch (err) {
      Logger.error('CategoriesTab.handleToggleMember', err);
      toast.error(t('common.error'));
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroup) return;
    try {
      await ConfigService.deleteCategoryGroup(deleteGroup.id);
      setDeleteGroup(null);
      await reload();
      toast.success(t('common.success'));
    } catch (err) {
      Logger.error('CategoriesTab.handleDeleteGroup', err);
      toast.error(t('common.error'));
    }
  };

  const handleApplyPalette = async (applications: PaletteApplication[]) => {
    try {
      await ConfigService.applyCategoryColors(
        applications.map((app) => ({ code: app.itemCode, color: app.newColor }))
      );
      await reload();
      toast.success(t('settings.categories.paletteApplied', { count: applications.length }));
    } catch (err) {
      Logger.error('CategoriesTab.applyPalette', err);
      toast.error(t('common.error'));
    }
  };

  const groupSelect = (
    value: number | null,
    onChange: (groupId: number | null) => void,
    className = 'ct-select w-full'
  ) => (
    <select
      className={className}
      value={value ?? ''}
      onChange={(e) => onChange(parseGroupId(e.target.value))}
    >
      <option value="">{t('settings.categories.noGroup')}</option>
      {groups.map((group) => (
        <option key={group.id} value={group.id}>
          {group.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="ct-card">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="ct-section-title">{t('settings.categories.title')}</h3>
            <p className="ct-hint">{t('settings.categories.hint')}</p>
          </div>
          {categories.length > 0 && (
            <button type="button" className="ct-btn-secondary" onClick={() => setShowPalette(true)}>
              <Palette size={16} /> {t('settings.palette.apply')}
            </button>
          )}
        </div>

        {categories.length === 0 && (
          <p className="text-sm py-4" style={{ color: 'var(--invoicing-gray-500)' }}>
            {t('settings.categories.empty')}
          </p>
        )}

        {categories.length > 0 && (
          <table className="ct-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>{t('common.code')}</th>
                <th>{t('common.name')}</th>
                <th style={{ width: 90 }}>{t('common.color')}</th>
                <th style={{ width: 200 }}>{t('settings.categories.group')}</th>
                <th style={{ width: 110 }}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) =>
                editingId === category.id ? (
                  <tr key={category.id}>
                    <td>
                      <input
                        className="ct-input w-full"
                        value={edit.code}
                        onChange={(e) => setEdit({ ...edit, code: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="ct-input w-full"
                        value={edit.name}
                        onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="color"
                        className="w-10 h-8 cursor-pointer rounded"
                        value={edit.color}
                        onChange={(e) => setEdit({ ...edit, color: e.target.value })}
                      />
                    </td>
                    <td>{groupSelect(edit.groupId, (groupId) => setEdit({ ...edit, groupId }))}</td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          className="ct-btn-icon"
                          onClick={() => void handleSaveEdit(category.id)}
                        >
                          <Check size={16} />
                        </button>
                        <button className="ct-btn-icon" onClick={() => setEditingId(null)}>
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={category.id}>
                    <td className="font-mono font-semibold">{category.code}</td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        {isTransferCategory(category.code)
                          ? t('common.categoryXName')
                          : category.name}
                        {isTransferCategory(category.code) && <CategoryXInfo />}
                      </span>
                    </td>
                    <td>
                      <CategorySwatch
                        code={category.code}
                        color={category.color}
                        className={`inline-block w-6 h-6 rounded-full${
                          isTransferCategory(category.code) ? '' : ' border'
                        }`}
                      />
                    </td>
                    <td>
                      {groupSelect(category.groupId, (groupId) =>
                        void handleAssignGroup(category, groupId)
                      )}
                    </td>
                    <td>
                      {isTransferCategory(category.code) ? (
                        <span className="text-xs" style={{ color: 'var(--invoicing-gray-500)' }}>
                          {t('common.categoryXProtected')}
                        </span>
                      ) : (
                      <div className="flex gap-1">
                        <button
                          className="ct-btn-icon"
                          title={t('common.edit')}
                          onClick={() => {
                            setEditingId(category.id);
                            setEdit({
                              code: category.code,
                              name: category.name,
                              color: category.color,
                              groupId: category.groupId,
                            });
                          }}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="ct-btn-icon hover:!text-red-500"
                          title={t('common.delete')}
                          onClick={() => setDeleteTarget(category)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}

        <div className="flex gap-3 mt-5 items-end flex-wrap" data-tour="onb-category-create">
          <div>
            <label className="ct-label">{t('common.code')}</label>
            <input
              className="ct-input w-28"
              placeholder="X"
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="ct-label">{t('common.name')}</label>
            <input
              className="ct-input w-full"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div>
            <label className="ct-label">{t('common.color')}</label>
            <input
              type="color"
              className="w-12 h-10 cursor-pointer rounded"
              value={draft.color}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            />
          </div>
          <div className="min-w-[160px]">
            <label className="ct-label">{t('settings.categories.group')}</label>
            {groupSelect(draft.groupId, (groupId) => setDraft({ ...draft, groupId }))}
          </div>
          <button
            className="ct-btn-primary"
            disabled={!draft.code.trim() || !draft.name.trim()}
            onClick={() => void handleAdd()}
          >
            <Plus size={16} /> {t('settings.categories.addCategory')}
          </button>
        </div>
      </section>

      <section className="ct-card">
        <h3 className="ct-section-title">{t('settings.categories.groupsTitle')}</h3>
        <p className="ct-hint">{t('settings.categories.groupsHint')}</p>

        {groups.length === 0 && (
          <p className="text-sm py-2" style={{ color: 'var(--invoicing-gray-500)' }}>
            {t('settings.categories.emptyGroups')}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {groups.map((group) => {
            const members = categories.filter((c) => c.groupId === group.id);
            const isEditing = editingGroupId === group.id;
            return (
              <div
                key={group.id}
                className="rounded-xl border p-3"
                style={{
                  borderColor: 'var(--invoicing-gray-200)',
                  borderLeftWidth: 4,
                  borderLeftColor: group.color,
                }}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  {isEditing ? (
                    <>
                      <input
                        type="color"
                        className="w-9 h-9 cursor-pointer rounded"
                        value={editGroup.color}
                        onChange={(e) => setEditGroup((p) => ({ ...p, color: e.target.value }))}
                      />
                      <input
                        className="ct-input flex-1 min-w-[160px]"
                        value={editGroup.name}
                        onChange={(e) => setEditGroup((p) => ({ ...p, name: e.target.value }))}
                      />
                      <button type="button" className="ct-btn-icon" onClick={() => void handleSaveGroup(group.id)}>
                        <Check size={16} />
                      </button>
                      <button type="button" className="ct-btn-icon" onClick={() => setEditingGroupId(null)}>
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span
                        className="inline-block w-6 h-6 rounded-full border flex-shrink-0"
                        style={{ backgroundColor: group.color, borderColor: 'var(--invoicing-gray-300)' }}
                      />
                      <span className="font-semibold flex-1" style={{ color: 'var(--invoicing-gray-900)' }}>
                        {group.name}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--invoicing-gray-500)' }}>
                        {t('settings.categories.memberCount', { count: members.length })}
                      </span>
                      <button
                        type="button"
                        className="ct-btn-icon"
                        title={t('common.edit')}
                        onClick={() => {
                          setEditingGroupId(group.id);
                          setEditGroup({ name: group.name, color: group.color });
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="ct-btn-icon hover:!text-red-500"
                        title={t('common.delete')}
                        onClick={() => setDeleteGroup(group)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
                    {categories.map((category) => (
                      <label key={category.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={category.groupId === group.id}
                          onChange={(e) => void handleToggleMember(group.id, category, e.target.checked)}
                        />
                        <span className="font-mono font-semibold">{category.code}</span>
                        <span style={{ color: 'var(--invoicing-gray-600)' }}>
                          {isTransferCategory(category.code)
                            ? t('common.categoryXName')
                            : category.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 mt-5 items-end flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="ct-label">{t('settings.categories.groupName')}</label>
            <input
              className="ct-input w-full"
              placeholder={t('settings.categories.groupNamePlaceholder')}
              value={groupDraft.name}
              onChange={(e) => setGroupDraft((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="ct-label">{t('common.color')}</label>
            <input
              type="color"
              className="w-12 h-10 cursor-pointer rounded"
              value={groupDraft.color}
              onChange={(e) => setGroupDraft((p) => ({ ...p, color: e.target.value }))}
            />
          </div>
          <button
            className="ct-btn-primary"
            disabled={!groupDraft.name.trim()}
            onClick={() => void handleAddGroup()}
          >
            <FolderPlus size={16} /> {t('settings.categories.addGroup')}
          </button>
        </div>
      </section>

      <PalettePreviewModal
        isOpen={showPalette}
        onClose={() => setShowPalette(false)}
        items={categories
          .filter((category) => !isTransferCategory(category.code))
          .map((category) => ({ code: category.code, name: category.name, color: category.color }))}
        nets={paletteNets}
        onApply={(apps) => void handleApplyPalette(apps)}
        title={t('settings.tabs.categories')}
      />

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title={t('settings.categories.deleteConfirmTitle')}
        message={`${deleteTarget?.name ?? ''} — ${t('settings.categories.deleteConfirmMessage')}`}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmModal
        isOpen={deleteGroup !== null}
        title={t('settings.categories.deleteGroupTitle')}
        message={t('settings.categories.deleteGroupMessage')}
        onConfirm={() => void handleDeleteGroup()}
        onCancel={() => setDeleteGroup(null)}
      />
    </div>
  );
};

export default CategoriesTab;
