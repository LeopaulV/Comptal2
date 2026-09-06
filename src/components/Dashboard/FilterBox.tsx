import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckSquare, SquareX } from 'lucide-react';

interface FilterItem {
  id: string;
  label: string;
  color?: string;
  checked: boolean;
}

interface FilterBoxProps {
  items: FilterItem[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}

const FilterBox: React.FC<FilterBoxProps> = React.memo(({ items, onToggle, onToggleAll }) => {
  const { t } = useTranslation();
  const allChecked = items.length > 0 && items.every((i) => i.checked);
  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <div className="filter-box">
      <div className="filter-header">
        <button type="button" className="toggle-all-button" onClick={onToggleAll}>
          {allChecked ? <SquareX size={14} /> : <CheckSquare size={14} />}
          {allChecked ? t('dashboard.none') : t('dashboard.all')}
        </button>
        {checkedCount > 0 && checkedCount < items.length && (
          <span className="selection-badge">{checkedCount}</span>
        )}
      </div>
      <div className="filter-box-list">
        {items.map((item) => (
          <div key={item.id} className="filter-item">
            <label className="filter-checkbox-label">
              <input
                type="checkbox"
                className="filter-checkbox-input"
                checked={item.checked}
                onChange={() => onToggle(item.id)}
              />
              <span className="filter-checkbox-custom" />
              {item.color && (
                <span className="filter-item-dot" style={{ backgroundColor: item.color }} />
              )}
              <span className="filter-item-text">{item.label}</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
});

FilterBox.displayName = 'FilterBox';
export default FilterBox;
