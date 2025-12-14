import React, { useEffect, useState } from 'react';
import { ConfigService } from '../../services/ConfigService';
import { CategoriesConfig } from '../../types/Category';

interface CategorySelectorProps {
  value?: string;
  onChange: (category: string) => void;
}

const CategorySelector: React.FC<CategorySelectorProps> = ({ value, onChange }) => {
  const [categories, setCategories] = useState<CategoriesConfig>({});

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const config = await ConfigService.loadCategories();
    setCategories(config);
  };

  const isProtected = value === 'X';
  
  return (
    <select
      value={value || ''}
      onChange={(e) => {
        // Empêcher la modification si la catégorie actuelle est "X"
        if (isProtected && e.target.value !== 'X') {
          alert('La catégorie "X" ne peut pas être modifiée.');
          return;
        }
        onChange(e.target.value);
      }}
      disabled={isProtected}
      className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg
               bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm
               focus:ring-2 focus:ring-primary-500 focus:border-transparent
               ${isProtected ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-75' : ''}`}
    >
      <option value="">Sans catégorie</option>
      {Object.entries(categories).map(([code, data]) => (
        <option key={code} value={code}>
          {data.name} ({code})
        </option>
      ))}
    </select>
  );
};

export default CategorySelector;

