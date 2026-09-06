import React from 'react';

export interface FinanceKpiItem {
  id: string;
  label: string;
  value: string;
  hint?: string;
}

const FinanceInsightKpis: React.FC<{ items: FinanceKpiItem[] }> = ({ items }) => (
  <div className="finance-kpi-grid">
    {items.map((item) => (
      <div key={item.id} className="finance-kpi" title={item.hint}>
        <span>{item.label}</span>
        <strong>{item.value}</strong>
      </div>
    ))}
  </div>
);

export default FinanceInsightKpis;
