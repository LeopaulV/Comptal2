import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  Pencil,
  Plus,
  Tags,
  Trash2,
} from 'lucide-react';
import { Category, CategoryGroup } from '../../types/models';
import { LabelRule } from '../../types/labelRule';
import { ConfigService } from '../../services/ConfigService';
import { LabelRuleService } from '../../services/LabelRuleService';
import { organizeCategoriesByGroup } from '../../utils/categoryGroups';
import { Logger } from '../../services/logger';
import ConfirmModal from '../Common/ConfirmModal';
import { CategorySwatch, CategoryXInfo } from '../Common/CategoryX';
import { isTransferCategory } from '../../utils/categories';

type PanelTab = 'categories' | 'routines';

interface CategoryPanelProps {
  categories: Category[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCategoriesChange: () => void;
  rulesVersion?: number;
  onAddRoutine?: () => void;
}

const CategoryPanel: React.FC<CategoryPanelProps> = ({
  categories,
  collapsed,
  onToggleCollapse,
  onCategoriesChange,
  rulesVersion = 0,
  onAddRoutine,
}) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<PanelTab>('categories');
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newCat, setNewCat] = useState({ code: '', name: '', color: '#0ea5e9', groupId: '' });
  const [newGroup, setNewGroup] = useState({ name: '', color: '#64748b' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFields, setEditFields] = useState({ name: '', color: '', groupId: '' });
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editGroup, setEditGroup] = useState({ name: '', color: '' });
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<CategoryGroup | null>(null);
  const [rules, setRules] = useState<LabelRule[]>([]);
  const [deleteRule, setDeleteRule] = useState<LabelRule | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());

  const sections = useMemo(
    () => organizeCategoriesByGroup(categories, groups),
    [categories, groups]
  );

  const reloadRules = async () => {
    try {
      setRules(await LabelRuleService.list());
    } catch (err) {
      Logger.error('CategoryPanel.reloadRules', err);
    }
  };

  const reloadGroups = async () => {
    try {
      setGroups(await ConfigService.listCategoryGroups());
    } catch (err) {
      Logger.error('CategoryPanel.reloadGroups', err);
    }
  };

  useEffect(() => {
    if (collapsed) return;
    void reloadRules();
  }, [collapsed, rulesVersion]);

  useEffect(() => {
    if (collapsed) return;
    void reloadGroups();
  }, [collapsed, categories]);

  const parseGroupId = (value: string): number | null => {
    if (!value) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const groupSelect = (
    value: string,
    onChange: (value: string) => void
  ) => (
    <select className="ct-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('edition.categoryNoGroup')}</option>
      {groups.map((group) => (
        <option key={group.id} value={String(group.id)}>
          {group.name}
        </option>
      ))}
    </select>
  );

  const handleAdd = async () => {
    const code = newCat.code.trim().toUpperCase();
    if (!code || !newCat.name.trim()) {
      toast.warn(t('edition.categoryFillFields'));
      return;
    }
    if (categories.some((c) => c.code === code)) {
      toast.warn(t('edition.categoryCodeExists'));
      return;
    }
    try {
      await ConfigService.createCategory({
        code,
        name: newCat.name.trim(),
        color: newCat.color,
        groupId: parseGroupId(newCat.groupId),
      });
      setIsAdding(false);
      setNewCat({ code: '', name: '', color: '#0ea5e9', groupId: '' });
      onCategoriesChange();
      toast.success(t('common.success'));
    } catch (err) {
      Logger.error('CategoryPanel.handleAdd', err);
      toast.error(t('common.error'));
    }
  };

  const handleSaveEdit = async (cat: Category) => {
    try {
      await ConfigService.updateCategory(cat.id, {
        name: editFields.name.trim(),
        color: editFields.color,
        groupId: parseGroupId(editFields.groupId),
      });
      setEditingId(null);
      onCategoriesChange();
      toast.success(t('common.success'));
    } catch (err) {
      Logger.error('CategoryPanel.handleSaveEdit', err);
      toast.error(t('common.error'));
    }
  };

  const handleAddGroup = async () => {
    if (!newGroup.name.trim()) {
      toast.warn(t('edition.categoryGroupFillName'));
      return;
    }
    try {
      await ConfigService.createCategoryGroup({
        name: newGroup.name.trim(),
        color: newGroup.color,
      });
      setIsAddingGroup(false);
      setNewGroup({ name: '', color: '#64748b' });
      await reloadGroups();
      toast.success(t('common.success'));
    } catch (err) {
      Logger.error('CategoryPanel.handleAddGroup', err);
      toast.error(t('common.error'));
    }
  };

  const handleSaveGroup = async (group: CategoryGroup) => {
    if (!editGroup.name.trim()) {
      toast.warn(t('edition.categoryGroupFillName'));
      return;
    }
    try {
      await ConfigService.updateCategoryGroup(group.id, {
        name: editGroup.name.trim(),
        color: editGroup.color,
      });
      setEditingGroupId(null);
      await reloadGroups();
      toast.success(t('common.success'));
    } catch (err) {
      Logger.error('CategoryPanel.handleSaveGroup', err);
      toast.error(t('common.error'));
    }
  };

  const handleDeleteRule = async () => {
    if (!deleteRule) return;
    try {
      await LabelRuleService.remove(deleteRule.id);
      setDeleteRule(null);
      await reloadRules();
      toast.success(t('common.success'));
    } catch (err) {
      Logger.error('CategoryPanel.handleDeleteRule', err);
      toast.error(t('common.error'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await ConfigService.deleteCategory(deleteTarget.id);
      setDeleteTarget(null);
      onCategoriesChange();
      toast.success(t('common.success'));
    } catch (err) {
      Logger.error('CategoryPanel.handleDelete', err);
      toast.error(t('common.error'));
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupTarget) return;
    try {
      await ConfigService.deleteCategoryGroup(deleteGroupTarget.id);
      setDeleteGroupTarget(null);
      await reloadGroups();
      onCategoriesChange();
      toast.success(t('common.success'));
    } catch (err) {
      Logger.error('CategoryPanel.handleDeleteGroup', err);
      toast.error(t('common.error'));
    }
  };

  const toggleGroupCollapsed = (id: number) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderCategoryItem = (c: Category) => {
    const isX = isTransferCategory(c.code);
    const displayName = isX ? t('common.categoryXName') : c.name;
    return (
    <div
      key={c.id}
      className={`edition-category-item${isX ? ' edition-category-item-x' : ''}`}
      {...(isX ? { 'data-tour-step': 'category-transfer-x' } : {})}
    >
      <CategorySwatch code={c.code} color={c.color} className="edition-category-dot" />
      {editingId === c.id ? (
        <div className="edition-category-edit-form">
          <input
            className="ct-input"
            value={editFields.name}
            onChange={(e) => setEditFields((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            type="color"
            className="w-full h-6"
            value={editFields.color}
            onChange={(e) => setEditFields((p) => ({ ...p, color: e.target.value }))}
          />
          {groupSelect(editFields.groupId, (groupId) => setEditFields((p) => ({ ...p, groupId })))}
          <button
            type="button"
            className="ct-btn-primary text-xs"
            onClick={() => void handleSaveEdit(c)}
          >
            {t('common.save')}
          </button>
        </div>
      ) : (
        <>
          <span className="edition-category-item-code">{c.code}</span>
          <span className="edition-category-item-name" title={displayName}>
            {displayName}
          </span>
          <div className="edition-category-actions">
            {isX ? (
              <CategoryXInfo />
            ) : (
              <>
                <button
                  type="button"
                  className="ct-btn-icon"
                  onClick={() => {
                    setEditingId(c.id);
                    setEditFields({
                      name: c.name,
                      color: c.color,
                      groupId: c.groupId != null ? String(c.groupId) : '',
                    });
                  }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="ct-btn-icon"
                  onClick={() => setDeleteTarget(c)}
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
    );
  };

  return (
    <aside className={`edition-category-panel${collapsed ? ' collapsed' : ''}`}>
      <div className="edition-category-panel-header">
        {collapsed ? (
          <button
            type="button"
            className="edition-category-toggle"
            onClick={onToggleCollapse}
            title={t('edition.expandPanel')}
          >
            <ChevronLeft size={16} />
          </button>
        ) : (
          <>
            <div className="edition-category-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'categories'}
                className={`edition-category-tab${tab === 'categories' ? ' active' : ''}`}
                onClick={() => setTab('categories')}
              >
                {t('edition.categoryPanel')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'routines'}
                className={`edition-category-tab${tab === 'routines' ? ' active' : ''}`}
                onClick={() => setTab('routines')}
              >
                {t('edition.routineLabelTab')}
              </button>
            </div>
            <button
              type="button"
              className="edition-category-toggle"
              onClick={onToggleCollapse}
              title={t('edition.collapsePanel')}
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </div>

      {collapsed ? (
        <div className="edition-category-panel-collapsed">
          <button
            type="button"
            className="edition-category-collapsed-icon"
            onClick={onToggleCollapse}
            title={t('edition.categoryPanel')}
          >
            <Tags size={18} />
          </button>
          <div className="edition-category-collapsed-list">
            {categories.map((c) => (
              <div
                key={c.id}
                className="edition-category-collapsed-item"
                title={`${c.code} — ${isTransferCategory(c.code) ? t('common.categoryXName') : c.name}`}
                style={isTransferCategory(c.code) ? undefined : { borderLeftColor: c.color }}
              >
                <CategorySwatch code={c.code} color={c.color} className="edition-category-collapsed-dot" />
                <span className="edition-category-collapsed-code">{c.code}</span>
              </div>
            ))}
          </div>
          <span className="edition-category-collapsed-count">{categories.length}</span>
        </div>
      ) : (
        <div className="edition-category-panel-body">
          {tab === 'categories' ? (
            <>
              <button
                type="button"
                className="edition-category-add-btn"
                onClick={() => {
                  setIsAdding((v) => !v);
                  setIsAddingGroup(false);
                }}
              >
                <Plus size={14} /> {t('edition.addCategory')}
              </button>
              <button
                type="button"
                className="edition-category-add-btn"
                onClick={() => {
                  setIsAddingGroup((v) => !v);
                  setIsAdding(false);
                }}
              >
                <FolderPlus size={14} /> {t('edition.addCategoryGroup')}
              </button>
              {isAdding && (
                <div className="edition-category-add-form">
                  <input
                    className="ct-input"
                    placeholder={t('common.code')}
                    value={newCat.code}
                    onChange={(e) => setNewCat((p) => ({ ...p, code: e.target.value }))}
                  />
                  <input
                    className="ct-input"
                    placeholder={t('common.name')}
                    value={newCat.name}
                    onChange={(e) => setNewCat((p) => ({ ...p, name: e.target.value }))}
                  />
                  <input
                    type="color"
                    className="w-full h-8 cursor-pointer"
                    value={newCat.color}
                    onChange={(e) => setNewCat((p) => ({ ...p, color: e.target.value }))}
                  />
                  {groupSelect(newCat.groupId, (groupId) => setNewCat((p) => ({ ...p, groupId })))}
                  <button type="button" className="ct-btn-primary" onClick={() => void handleAdd()}>
                    {t('common.add')}
                  </button>
                </div>
              )}
              {isAddingGroup && (
                <div className="edition-category-add-form">
                  <input
                    className="ct-input"
                    placeholder={t('edition.categoryGroupName')}
                    value={newGroup.name}
                    onChange={(e) => setNewGroup((p) => ({ ...p, name: e.target.value }))}
                  />
                  <input
                    type="color"
                    className="w-full h-8 cursor-pointer"
                    value={newGroup.color}
                    onChange={(e) => setNewGroup((p) => ({ ...p, color: e.target.value }))}
                  />
                  <button type="button" className="ct-btn-primary" onClick={() => void handleAddGroup()}>
                    {t('common.add')}
                  </button>
                </div>
              )}
              {sections.map((section) => {
                const group = section.group;
                if (!group) {
                  if (section.categories.length === 0) return null;
                  return (
                    <div key="ungrouped" className="edition-category-group">
                      {groups.length > 0 && (
                        <div className="edition-category-ungrouped-label">
                          {t('edition.ungroupedCategories')}
                        </div>
                      )}
                      {section.categories.map(renderCategoryItem)}
                    </div>
                  );
                }
                const isCollapsed = collapsedGroups.has(group.id);
                return (
                  <div key={group.id} className="edition-category-group">
                    {editingGroupId === group.id ? (
                      <div className="edition-category-add-form">
                        <input
                          className="ct-input"
                          value={editGroup.name}
                          onChange={(e) => setEditGroup((p) => ({ ...p, name: e.target.value }))}
                        />
                        <input
                          type="color"
                          className="w-full h-6 cursor-pointer"
                          value={editGroup.color}
                          onChange={(e) => setEditGroup((p) => ({ ...p, color: e.target.value }))}
                        />
                        <button
                          type="button"
                          className="ct-btn-primary text-xs"
                          onClick={() => void handleSaveGroup(group)}
                        >
                          {t('common.save')}
                        </button>
                      </div>
                    ) : (
                      <div
                        className="edition-category-group-header"
                        style={{ borderLeftColor: group.color }}
                      >
                        <button
                          type="button"
                          className="edition-category-group-toggle"
                          onClick={() => toggleGroupCollapsed(group.id)}
                          aria-expanded={!isCollapsed}
                        >
                          <ChevronDown
                            size={14}
                            style={{ transform: isCollapsed ? 'rotate(-90deg)' : undefined }}
                          />
                          <span
                            className="edition-category-dot"
                            style={{ backgroundColor: group.color }}
                          />
                          <span className="edition-category-group-header-label" title={group.name}>
                            {group.name}
                          </span>
                          <span className="edition-category-group-count">
                            {section.categories.length}
                          </span>
                        </button>
                        <div className="edition-category-actions">
                          <button
                            type="button"
                            className="ct-btn-icon"
                            onClick={() => {
                              setEditingGroupId(group.id);
                              setEditGroup({ name: group.name, color: group.color });
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="ct-btn-icon"
                            onClick={() => setDeleteGroupTarget(group)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                    {!isCollapsed && (
                      <div className="edition-category-group-items">
                        {section.categories.length === 0 ? (
                          <p className="ct-hint m-0">{t('edition.categoryGroupEmpty')}</p>
                        ) : (
                          section.categories.map(renderCategoryItem)
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {categories.length === 0 && groups.length === 0 && (
                <p className="ct-hint m-0 text-center">{t('settings.categories.empty')}</p>
              )}
            </>
          ) : (
            <>
              {onAddRoutine && (
                <button type="button" className="edition-category-add-btn" onClick={onAddRoutine}>
                  <Plus size={14} /> {t('edition.routineLabelToolbar')}
                </button>
              )}
              {rules.map((rule) => {
                const cat = categories.find((c) => c.code === rule.categoryCode);
                return (
                  <div key={rule.id} className="edition-category-item edition-routine-item">
                    <span className="edition-routine-word" title={rule.word}>
                      {rule.word}
                    </span>
                    <span
                      className="edition-routine-cat"
                      title={cat ? `${cat.code} — ${cat.name}` : (rule.categoryCode ?? '')}
                    >
                      {rule.categoryCode ?? '—'}
                    </span>
                    <button
                      type="button"
                      className="ct-btn-icon"
                      title={t('common.delete')}
                      onClick={() => setDeleteRule(rule)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
              {rules.length === 0 && (
                <p className="ct-hint m-0 text-center">{t('edition.routineLabelListEmpty')}</p>
              )}
            </>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title={t('common.delete')}
        message={t('settings.categories.deleteConfirmMessage')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
      <ConfirmModal
        isOpen={deleteGroupTarget !== null}
        title={t('common.delete')}
        message={t('edition.categoryGroupDeleteConfirm')}
        onCancel={() => setDeleteGroupTarget(null)}
        onConfirm={() => void handleDeleteGroup()}
      />
      <ConfirmModal
        isOpen={deleteRule !== null}
        title={t('common.delete')}
        message={t('edition.routineLabelDeleteConfirm')}
        onCancel={() => setDeleteRule(null)}
        onConfirm={() => void handleDeleteRule()}
      />
    </aside>
  );
};

export default CategoryPanel;
