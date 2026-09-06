import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import {
  Building2,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Settings,
  Tags,
} from 'lucide-react';
import { ChartGranularity } from '../../types/projection';
import { DistinctPeriods } from '../../services/StatsService';
import FilterBox from '../Dashboard/FilterBox';
import PeriodFilterButtons from '../Dashboard/PeriodFilterButtons';
import ChartGranularityZoom from '../Common/ChartGranularityZoom';
import { Account, Category } from '../../types/models';

interface FinanceToolbarProps {
  granularity: ChartGranularity;
  onGranularityChange: (g: ChartGranularity) => void;
  bounds: { min: string; max: string };
  dateStart: string;
  dateEnd: string;
  onDateChange: (start: string, end: string) => void;
  periods: DistinctPeriods;
  accounts: Account[];
  categories: Category[];
  selectedAccountIds: Set<number>;
  selectedCategoryCodes: Set<string>;
  onToggleAccount: (id: number) => void;
  onToggleAllAccounts: () => void;
  onToggleCategory: (code: string) => void;
  onToggleAllCategories: () => void;
  onConfigureCharts: () => void;
}

const FinanceToolbar: React.FC<FinanceToolbarProps> = ({
  granularity,
  onGranularityChange,
  bounds,
  dateStart,
  dateEnd,
  onDateChange,
  periods,
  accounts,
  categories,
  selectedAccountIds,
  selectedCategoryCodes,
  onToggleAccount,
  onToggleAllAccounts,
  onToggleCategory,
  onToggleAllCategories,
  onConfigureCharts,
}) => {
  const { t } = useTranslation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAccountFilterCollapsed, setIsAccountFilterCollapsed] = useState(false);
  const [isCategoryFilterCollapsed, setIsCategoryFilterCollapsed] = useState(false);
  const [isPeriodFilterCollapsed, setIsPeriodFilterCollapsed] = useState(false);

  const validCategories = categories.filter((c) => c.code !== 'X');

  return (
    <aside
      className={`finance-global-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}
    >
      <div className="sidebar-header">
        <button
          type="button"
          className="sidebar-collapse-button"
          onClick={() => setIsSidebarCollapsed((v) => !v)}
          title={
            isSidebarCollapsed
              ? t('dashboard.expandSidebar')
              : `${t('dashboard.collapseSidebar')} — ${selectedAccountIds.size}/${accounts.length} ${t('dashboard.accounts')}, ${selectedCategoryCodes.size}/${validCategories.length} ${t('dashboard.categories')}`
          }
        >
          {isSidebarCollapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
        {!isSidebarCollapsed && (
          <>
            <h3>{t('dashboard.filters')}</h3>
            <button
              type="button"
              className="ct-btn-icon finance-sidebar-config"
              onClick={onConfigureCharts}
              title={t('financeGlobal.configureCharts')}
            >
              <Settings size={18} />
            </button>
          </>
        )}
      </div>

      {isSidebarCollapsed && (
        <div className="sidebar-collapsed-badges">
          <span
            className="sidebar-mini-badge"
            title={`${t('dashboard.accounts')}: ${selectedAccountIds.size}/${accounts.length}`}
          >
            <Building2 size={16} aria-hidden />
            <span className="sidebar-mini-badge-value">{selectedAccountIds.size}</span>
          </span>
          <span
            className="sidebar-mini-badge"
            title={`${t('dashboard.categories')}: ${selectedCategoryCodes.size}/${validCategories.length}`}
          >
            <Tags size={16} aria-hidden />
            <span className="sidebar-mini-badge-value">{selectedCategoryCodes.size}</span>
          </span>
          {dateStart && dateEnd && (
            <span
              className="sidebar-mini-badge"
              title={`${t('dashboard.periodLabel')}: ${format(parseISO(dateStart), 'dd/MM/yyyy')} → ${format(parseISO(dateEnd), 'dd/MM/yyyy')}`}
            >
              <Calendar size={16} aria-hidden />
            </span>
          )}
          <button
            type="button"
            className="sidebar-mini-badge"
            onClick={onConfigureCharts}
            title={t('financeGlobal.configureCharts')}
          >
            <Settings size={16} aria-hidden />
          </button>
        </div>
      )}

      {!isSidebarCollapsed && (
        <div className="sidebar-filter-stack">
          <div className="finance-sidebar-zoom">
            <ChartGranularityZoom
              granularity={granularity}
              onChange={onGranularityChange}
            />
          </div>

          <div
            className={`sidebar-filter-section sidebar-filter-section-grow${isAccountFilterCollapsed ? ' is-collapsed' : ''}`}
          >
            <div
              className="filter-section-header"
              onClick={() => setIsAccountFilterCollapsed((v) => !v)}
            >
              <h5>
                <Building2 size={16} />
                {t('dashboard.accounts')}
                <span className="filter-section-count">{selectedAccountIds.size}</span>
              </h5>
              {isAccountFilterCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </div>
            {!isAccountFilterCollapsed && (
              <div className="filter-section-body">
                <FilterBox
                  items={accounts.map((a) => ({
                    id: String(a.id),
                    label: a.code,
                    color: a.color,
                    checked: selectedAccountIds.has(a.id),
                  }))}
                  onToggle={(id) => onToggleAccount(Number(id))}
                  onToggleAll={onToggleAllAccounts}
                />
              </div>
            )}
          </div>

          <div
            className={`sidebar-filter-section sidebar-filter-section-grow${isCategoryFilterCollapsed ? ' is-collapsed' : ''}`}
          >
            <div
              className="filter-section-header"
              onClick={() => setIsCategoryFilterCollapsed((v) => !v)}
            >
              <h5>
                <Tags size={16} />
                {t('dashboard.categories')}
                <span className="filter-section-count">{selectedCategoryCodes.size}</span>
              </h5>
              {isCategoryFilterCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </div>
            {!isCategoryFilterCollapsed && (
              <div className="filter-section-body">
                <FilterBox
                  items={validCategories.map((c) => ({
                    id: c.code,
                    label: c.name,
                    color: c.color,
                    checked: selectedCategoryCodes.has(c.code),
                  }))}
                  onToggle={onToggleCategory}
                  onToggleAll={onToggleAllCategories}
                />
              </div>
            )}
          </div>

          <div
            className={`sidebar-filter-section sidebar-filter-section-period${isPeriodFilterCollapsed ? ' is-collapsed' : ''}`}
          >
            <div
              className="filter-section-header"
              onClick={() => setIsPeriodFilterCollapsed((v) => !v)}
            >
              <h5>
                <Calendar size={16} />
                {t('dashboard.periodLabel')}
              </h5>
              {isPeriodFilterCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </div>
            {!isPeriodFilterCollapsed && (
              <div className="filter-section-body">
                <PeriodFilterButtons
                  minDate={bounds.min}
                  maxDate={bounds.max}
                  start={dateStart}
                  end={dateEnd}
                  weeks={periods.weeks}
                  months={periods.months}
                  years={periods.years}
                  onPeriodChange={onDateChange}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

export default FinanceToolbar;
