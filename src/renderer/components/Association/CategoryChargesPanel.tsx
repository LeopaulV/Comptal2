import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Project } from '../../types/ProjectManagement';
import { Transaction } from '../../types/Transaction';
import { CategoriesConfig } from '../../types/Category';
import { ConfigService } from '../../services/ConfigService';
import { formatCurrency } from '../../utils/format';
import { format, startOfYear, endOfYear } from 'date-fns';
import { computeCategoryChargesData } from '../../utils/categoryCharges';

interface CategoryChargesPanelProps {
  project: Project | null;
  transactions: Transaction[];
  categories: CategoriesConfig;
  onProjectChange: (project: Project) => void;
}

export const CategoryChargesPanel: React.FC<CategoryChargesPanelProps> = ({
  project,
  transactions,
  categories,
  onProjectChange,
}) => {
  const { t } = useTranslation();
  const now = new Date();
  const defaultStart = startOfYear(now);
  const defaultEnd = endOfYear(now);

  const [startDate, setStartDate] = useState<string>(format(defaultStart, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(defaultEnd, 'yyyy-MM-dd'));
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (project?.categoryChargesConfig) {
      setStartDate(format(project.categoryChargesConfig.referencePeriod.startDate, 'yyyy-MM-dd'));
      setEndDate(format(project.categoryChargesConfig.referencePeriod.endDate, 'yyyy-MM-dd'));
      setSelectedCodes(new Set(project.categoryChargesConfig.selectedCategories));
    }
  }, [project]);

  const referencePeriod = useMemo(() => ({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  }), [startDate, endDate]);

  const allCategoryCodes = useMemo(
    () => Object.keys(categories).sort((a, b) => categories[a].name.localeCompare(categories[b].name, 'fr', { sensitivity: 'base' })),
    [categories]
  );

  const previewData = useMemo(() => {
    return computeCategoryChargesData(
      transactions,
      allCategoryCodes,
      referencePeriod,
      categories
    );
  }, [transactions, allCategoryCodes, referencePeriod, categories]);

  const toggleCategory = useCallback((code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }, []);

  const handleApply = useCallback(async () => {
    if (!project) return;

    const updated: Project = {
      ...project,
      chargesMode: 'categories',
      categoryChargesConfig: {
        referencePeriod: {
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        },
        selectedCategories: Array.from(selectedCodes),
      },
      updatedAt: new Date(),
    };

    await ConfigService.saveProject(updated);
    onProjectChange(updated);
  }, [project, startDate, endDate, selectedCodes, onProjectChange]);

  if (!project) {
    return (
      <div className="invoicing-empty" style={{ padding: 40, textAlign: 'center' }}>
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="category-charges-panel">
      <p className="category-charges-hint" style={{ marginBottom: 16, fontSize: '0.9rem', color: 'var(--invoicing-gray-600)' }}>
        {t('association.postes.categoryChargesHint', 'Sélectionnez les catégories et la période de référence. Les graphiques et le PDF utiliseront les transactions réelles agrégées.')}
      </p>

      <div className="category-charges-period" style={{ marginBottom: 20, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('association.postes.referencePeriodStart', 'Date de début')}
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('association.postes.referencePeriodEnd', 'Date de fin')}
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="category-charges-table-wrapper" style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table className="invoicing-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--invoicing-gray-200)' }}>
                {t('association.postes.categoryInclude', 'Inclure')}
              </th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--invoicing-gray-200)' }}>
                {t('association.postes.categoryName', 'Catégorie')}
              </th>
              <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '1px solid var(--invoicing-gray-200)' }}>
                {t('association.postes.categoryTotal', 'Total période')}
              </th>
              <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '1px solid var(--invoicing-gray-200)' }}>
                {t('association.postes.categoryAverage', 'Moyenne mensuelle')}
              </th>
            </tr>
          </thead>
          <tbody>
            {allCategoryCodes.map((code) => {
              const cat = categories[code];
              const data = previewData?.categories.find((c) => c.code === code);
              const total = data?.total ?? 0;
              const average = data?.average ?? 0;

              return (
                <tr key={code} style={{ borderBottom: '1px solid var(--invoicing-gray-100)' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <input
                      type="checkbox"
                      checked={selectedCodes.has(code)}
                      onChange={() => toggleCategory(code)}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                  </td>
                  <td style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 4,
                        backgroundColor: cat?.color || '#0ea5e9',
                        flexShrink: 0,
                      }}
                    />
                    {cat?.name || code}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    {formatCurrency(total)}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    {formatCurrency(average)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {allCategoryCodes.length === 0 && (
        <p style={{ color: 'var(--invoicing-gray-500)', fontSize: '0.9rem' }}>
          {t('association.postes.noCategories', 'Aucune catégorie définie. Créez des catégories dans les paramètres.')}
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button
          onClick={handleApply}
          className="primary"
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            fontWeight: 500,
          }}
        >
          {t('association.postes.applyCategoryCharges', 'Appliquer')}
        </button>
      </div>
    </div>
  );
};
