import React from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faCheckSquare, faTimesSquare } from '@fortawesome/free-solid-svg-icons';

interface FilterBoxProps {
  title: string;
  icon: IconDefinition;
  items: Array<{ value: string; label: string; checked: boolean }>;
  onToggle: (value: string) => void;
  onToggleAll: () => void;
}

const FilterBox: React.FC<FilterBoxProps> = ({
  title,
  icon,
  items,
  onToggle,
  onToggleAll,
}) => {
  const { t } = useTranslation();
  const allChecked = items.length > 0 && items.every(item => item.checked);
  const checkedCount = items.filter(item => item.checked).length;

  return (
    <div className="filter-box">
      <h5>
        <FontAwesomeIcon icon={icon} className="mr-2" />
        {title}
      </h5>
      <div className="filter-box-content">
        <div className="filter-header">
          <button
            onClick={onToggleAll}
            className="toggle-all-button"
            type="button"
          >
            <FontAwesomeIcon icon={allChecked ? faTimesSquare : faCheckSquare} className="mr-1" />
            {allChecked ? t('filter.deselectAll') : t('filter.selectAll')}
          </button>
          {checkedCount > 0 && (
            <span className="selection-badge">
              {t('filter.selected', { count: checkedCount })}
            </span>
          )}
        </div>
        {items.map((item) => (
          <div key={item.value} className="filter-item">
            <label className="custom-checkbox">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => onToggle(item.value)}
              />
              <span className="checkmark"></span>
              <span className="label-text">{item.label}</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FilterBox;

