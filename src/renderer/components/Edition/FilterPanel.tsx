import React, { useEffect, useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { TransactionFilter } from '../../types/Transaction';
import { ConfigService } from '../../services/ConfigService';
import { Button } from '../Common';

interface FilterPanelProps {
  filter: TransactionFilter;
  onFilterChange: (filter: TransactionFilter) => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ filter, onFilterChange }) => {
  const [accounts, setAccounts] = useState<Array<{ code: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ code: string; name: string }>>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    const [accountsConfig, categoriesConfig] = await Promise.all([
      ConfigService.loadAccounts(),
      ConfigService.loadCategories(),
    ]);

    setAccounts(
      Object.entries(accountsConfig).map(([code, data]) => ({
        code,
        name: data.name,
      }))
    );

    setCategories(
      Object.entries(categoriesConfig).map(([code, data]) => ({
        code,
        name: data.name,
      }))
    );
  };

  const handleSearchChange = (value: string) => {
    onFilterChange({ ...filter, searchTerm: value || undefined });
  };

  const handleAccountToggle = (code: string) => {
    const currentAccounts = filter.accountCodes || [];
    const newAccounts = currentAccounts.includes(code)
      ? currentAccounts.filter(c => c !== code)
      : [...currentAccounts, code];
    
    onFilterChange({ 
      ...filter, 
      accountCodes: newAccounts.length > 0 ? newAccounts : undefined 
    });
  };

  const handleCategoryToggle = (code: string) => {
    const currentCategories = filter.categoryCodes || [];
    const newCategories = currentCategories.includes(code)
      ? currentCategories.filter(c => c !== code)
      : [...currentCategories, code];
    
    onFilterChange({ 
      ...filter, 
      categoryCodes: newCategories.length > 0 ? newCategories : undefined 
    });
  };

  const handleTypeChange = (type: 'all' | 'income' | 'expense') => {
    onFilterChange({ ...filter, type });
  };

  const handleReset = () => {
    onFilterChange({});
  };

  const hasActiveFilters = 
    filter.searchTerm || 
    (filter.accountCodes && filter.accountCodes.length > 0) ||
    (filter.categoryCodes && filter.categoryCodes.length > 0) ||
    filter.type !== 'all';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 space-y-4">
      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Rechercher dans les transactions..."
          value={filter.searchTerm || ''}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 
                   rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                   focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Bouton pour étendre les filtres */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300
                   hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          <Filter size={16} />
          Filtres avancés
        </button>
        
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <X size={16} />
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Filtres avancés */}
      {isExpanded && (
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {/* Type de transaction */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type de transaction
            </label>
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'Toutes' },
                { value: 'income', label: 'Revenus' },
                { value: 'expense', label: 'Dépenses' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleTypeChange(option.value as any)}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${(filter.type || 'all') === option.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comptes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Comptes
            </label>
            <div className="flex flex-wrap gap-2">
              {accounts.map((account) => (
                <button
                  key={account.code}
                  onClick={() => handleAccountToggle(account.code)}
                  className={`
                    px-3 py-1 rounded-full text-sm font-medium transition-colors
                    ${(filter.accountCodes || []).includes(account.code)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }
                  `}
                >
                  {account.name}
                </button>
              ))}
            </div>
          </div>

          {/* Catégories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Catégories
            </label>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {categories.map((category) => (
                <button
                  key={category.code}
                  onClick={() => handleCategoryToggle(category.code)}
                  className={`
                    px-3 py-1 rounded-full text-sm font-medium transition-colors
                    ${(filter.categoryCodes || []).includes(category.code)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }
                  `}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;

