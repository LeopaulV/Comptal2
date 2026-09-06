import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pie } from 'react-chartjs-2';
import { ChartOptions } from 'chart.js';
import { BreakdownSlice } from '../../../types/forecast';
import { formatMoney } from '../../../utils/amounts';
import { useTheme } from '../../../hooks/useTheme';
import { chartAxisColor, chartPastelNamed, chartSurfaceColor, chartTooltipTheme } from '../../../utils/chartPastel';
import '../../../utils/registerCharts';

interface DebitCreditPieWidgetProps {
  slices: BreakdownSlice[];
}

const DebitCreditPieWidget: React.FC<DebitCreditPieWidgetProps> = ({ slices }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const axis = chartAxisColor(isDark);
  const tooltip = chartTooltipTheme(isDark);
  const debitColor = chartPastelNamed('red');
  const creditColor = chartPastelNamed('green');

  const colored = useMemo(
    () =>
      slices.map((slice) => ({
        ...slice,
        label: slice.id === 'debit' ? t('previsionnel.flow.debit') : t('previsionnel.flow.credit'),
        color: slice.id === 'debit' ? debitColor : creditColor,
      })),
    [slices, debitColor, creditColor, t]
  );
  const total = colored.reduce((sum, slice) => sum + slice.value, 0);

  const data = useMemo(
    () => ({
      labels: colored.map((s) => s.label),
      datasets: [
        {
          data: colored.map((s) => s.value),
          backgroundColor: colored.map((s) => s.color),
          borderColor: chartSurfaceColor(isDark),
          borderWidth: 1,
        },
      ],
    }),
    [colored, isDark]
  );

  const options: ChartOptions<'pie'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: axis },
        },
        tooltip: {
          ...tooltip,
          callbacks: {
            label: (ctx) => {
              const value = Number(ctx.parsed);
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              return t('previsionnel.tooltip.percent', {
                value: `${ctx.label}: ${formatMoney(value)}`,
                percentage: pct,
              });
            },
          },
        },
      },
    }),
    [axis, tooltip, total, t]
  );

  if (slices.length === 0) return <p className="previsionnel-empty-chart">—</p>;

  return (
    <div className="previsionnel-chart-h">
      <Pie data={data} options={options} />
    </div>
  );
};

export default DebitCreditPieWidget;
