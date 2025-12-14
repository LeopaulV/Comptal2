import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckSquare, faTimesSquare } from '@fortawesome/free-solid-svg-icons';
import CustomCheckbox from './CustomCheckbox';

interface FilterBoxProps {
  title: string;
  icon: any;
  items: Array<{ code: string; name: string; color?: string }>;
  selectedItems: string[];
  onSelectionChange: (selected: string[]) => void;
}

const FilterBox: React.FC<FilterBoxProps> = ({
  title,
  icon,
  items,
  selectedItems,
  onSelectionChange
}) => {
  const [allSelected, setAllSelected] = useState(true);

  const handleToggleAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(items.map(item => item.code));
    }
    setAllSelected(!allSelected);
  };

  const handleItemToggle = (code: string) => {
    const newSelected = selectedItems.includes(code)
      ? selectedItems.filter(c => c !== code)
      : [...selectedItems, code];
    
    onSelectionChange(newSelected);
    setAllSelected(newSelected.length === items.length);
  };

  return (
    <div className="filter-box">
      <h5 className="flex items-center gap-2">
        <FontAwesomeIcon icon={icon} className="text-primary-600" />
        {title}
      </h5>
      
      <div className="filter-header">
        <button
          onClick={handleToggleAll}
          className="w-full px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors flex items-center justify-center gap-1"
        >
          <FontAwesomeIcon icon={allSelected ? faTimesSquare : faCheckSquare} />
          {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>
      </div>

      <div className="filter-box-content">
        {items.map((item) => (
          <div key={item.code} className="filter-item">
            <CustomCheckbox
              label={item.name}
              checked={selectedItems.includes(item.code)}
              onChange={() => handleItemToggle(item.code)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default FilterBox;

