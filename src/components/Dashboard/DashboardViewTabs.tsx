import React from 'react';
import { useTranslation } from 'react-i18next';

export type DashboardViewTab = 'charts' | 'summary';

interface DashboardViewTabsProps {
  active: DashboardViewTab;
  onChange: (tab: DashboardViewTab) => void;
}

const DashboardViewTabs: React.FC<DashboardViewTabsProps> = ({ active, onChange }) => {
  const { t } = useTranslation();
  const tabs: Array<{ id: DashboardViewTab; label: string }> = [
    { id: 'charts', label: t('dashboard.tabCharts') },
    { id: 'summary', label: t('dashboard.tabSummary') },
  ];

  return (
    <div className="dashboard-view-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`dashboard-view-tab ${active === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default DashboardViewTabs;
