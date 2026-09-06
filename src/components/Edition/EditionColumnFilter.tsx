import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp } from 'lucide-react';

interface EditionColumnFilterProps {
  values: string[];
  selected: Set<string> | null;
  search: string;
  onSearch: (value: string) => void;
  onToggle: (value: string) => void;
  onSelectAll: (checked: boolean) => void;
  onApplyVisible: (values: string[]) => void;
  onSortAsc: () => void;
  onSortDesc: () => void;
  position: { top: number; left: number };
  onClose: () => void;
}

const EditionColumnFilter: React.FC<EditionColumnFilterProps> = ({
  values,
  selected,
  search,
  onSearch,
  onToggle,
  onSelectAll,
  onApplyVisible,
  onSortAsc,
  onSortDesc,
  position,
  onClose,
}) => {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const blank = t('edition.filterBlank');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return values;
    return values.filter((value) => {
      const label = value === '' ? blank : value;
      return label.toLowerCase().includes(q);
    });
  }, [values, search, blank]);

  const hasSearch = search.trim().length > 0;
  const allSelected =
    selected == null || (values.length > 0 && values.every((value) => selected.has(value)));

  const applyVisibleSelection = () => {
    const keep = visible.filter((value) => selected == null || selected.has(value));
    onApplyVisible(keep);
  };

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      const node = panelRef.current;
      if (!node) return;
      if (node.contains(event.target as Node)) return;
      if ((event.target as HTMLElement).closest('.edition-excel-table th.sortable')) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="edition-excel-filter-panel"
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="edition-excel-filter-sorts">
        <button type="button" className="edition-excel-filter-sort" onClick={onSortAsc}>
          <ArrowUp size={14} /> {t('edition.filterSortAsc')}
        </button>
        <button type="button" className="edition-excel-filter-sort" onClick={onSortDesc}>
          <ArrowDown size={14} /> {t('edition.filterSortDesc')}
        </button>
      </div>
      <input
        type="text"
        className="edition-excel-filter-search"
        placeholder={t('common.search')}
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || !hasSearch || visible.length === 0) return;
          e.preventDefault();
          applyVisibleSelection();
        }}
        autoFocus
      />
      {hasSearch && (
        <button
          type="button"
          className="edition-excel-filter-apply"
          disabled={visible.length === 0}
          title={t('edition.filterApplyVisibleHint')}
          onClick={applyVisibleSelection}
        >
          {t('edition.filterApplyVisible')}
        </button>
      )}
      <label className="edition-excel-filter-select-all">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(e) => onSelectAll(e.target.checked)}
        />
        {t('edition.selectAll')}
      </label>
      <div className="edition-excel-filter-list">
        {visible.map((value) => {
          const checked = selected == null || selected.has(value);
          const label = value === '' ? blank : value;
          return (
            <label key={value || '__blank__'} className="edition-excel-filter-item">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(value)}
              />
              <span title={label}>{label}</span>
            </label>
          );
        })}
        {visible.length === 0 && (
          <p className="edition-excel-filter-empty">{t('edition.filterNoValues')}</p>
        )}
      </div>
    </div>
  );
};

export default EditionColumnFilter;
