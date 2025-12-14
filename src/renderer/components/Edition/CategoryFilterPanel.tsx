import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckSquare, faSquare } from '@fortawesome/free-solid-svg-icons';
import { ConfigService } from '../../services/ConfigService';
import { CategoriesConfig } from '../../types/Category';

interface CategoryFilterPanelProps {
  selectedCategories: string[];
  showUncategorized: boolean;
  onCategoryFilterChange: (categories: string[], showUncategorized: boolean) => void;
}

const CategoryFilterPanel: React.FC<CategoryFilterPanelProps> = ({
  selectedCategories,
  showUncategorized,
  onCategoryFilterChange,
}) => {
  const [categories, setCategories] = useState<CategoriesConfig>({});

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const config = await ConfigService.loadCategories();
      setCategories(config);
      
      // Ne pas initialiser automatiquement les catégories
      // Par défaut, seules les lignes non catégorisées seront affichées
      // (showUncategorized est déjà à true par défaut dans Edition.tsx)
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error);
    }
  };

  const handleSelectAll = () => {
    const allCategories = Object.keys(categories).filter(
      code => code !== '???' && code !== '!!!'
    );
    onCategoryFilterChange(allCategories, true);
  };

  const handleDeselectAll = () => {
    onCategoryFilterChange([], false);
  };

  const handleCategoryToggle = (code: string) => {
    if (selectedCategories.includes(code)) {
      onCategoryFilterChange(
        selectedCategories.filter(c => c !== code),
        showUncategorized
      );
    } else {
      onCategoryFilterChange([...selectedCategories, code], showUncategorized);
    }
  };

  const handleUncategorizedToggle = (checked: boolean) => {
    onCategoryFilterChange(selectedCategories, checked);
  };

  const calculateTextColor = (backgroundColor: string): string => {
    // Convertir hex en RGB
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Calculer la luminosité relative
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  };

  return (
    <div className="category-filters">
      <div className="filter-actions">
        <button
          className="filter-button"
          onClick={handleSelectAll}
          title="Tout sélectionner"
        >
          <FontAwesomeIcon icon={faCheckSquare} />
          Tout sélectionner
        </button>
        <button
          className="filter-button"
          onClick={handleDeselectAll}
          title="Tout désélectionner"
        >
          <FontAwesomeIcon icon={faSquare} />
          Tout désélectionner
        </button>
      </div>

      <div className="uncategorized-filter">
        <label className="d-flex align-items-center">
          <input
            type="checkbox"
            className="form-check-input category-filter"
            id="uncategorized-filter"
            checked={showUncategorized}
            onChange={(e) => handleUncategorizedToggle(e.target.checked)}
          />
          <span className="ms-2">Non catégorisées</span>
        </label>
      </div>

      <div className="category-checkboxes">
        {Object.entries(categories)
          .filter(([code]) => code !== '???' && code !== '!!!')
          .map(([code, data]) => {
            const color = data.color || '#cccccc';
            const textColor = calculateTextColor(color);

            return (
              <div
                key={code}
                className="category-filter-item"
                style={{
                  '--category-color': color,
                  '--text-color': textColor,
                } as React.CSSProperties}
              >
                <label className="d-flex align-items-center">
                  <input
                    type="checkbox"
                    className="form-check-input category-filter"
                    value={code}
                    checked={selectedCategories.includes(code)}
                    onChange={() => handleCategoryToggle(code)}
                  />
                  <span
                    className="category-label ms-2"
                    style={{
                      backgroundColor: color,
                      color: textColor,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                    }}
                  >
                    {data.name}
                  </span>
                </label>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default CategoryFilterPanel;

