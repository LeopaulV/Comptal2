import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chart as ChartJS, ChartOptions, registerables } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { formatCurrency } from '../../utils/format';

ChartJS.register(...registerables);

interface AccountBalanceLineChartProps {
  periods: string[];
  accounts: string[];
  balanceData: number[][];
  accountColors: Record<string, string>;
  granularity: 'day' | 'week' | 'month';
}

const AccountBalanceLineChart: React.FC<AccountBalanceLineChartProps> = ({
  periods,
  accounts,
  balanceData,
  accountColors,
  granularity,
}) => {
  const { t } = useTranslation();
  const chartRef = useRef<ChartJS<'line'>>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => 
    document.documentElement.classList.contains('dark')
  );

  // Observer les changements de thème
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  // Fonction pour calculer les limites de l'axe Y en fonction des datasets visibles
  const calculateYAxisLimits = useCallback((datasets: any[]) => {
    if (datasets.length === 0 || !datasets[0]?.data) {
      return { min: 0, max: 1000 };
    }

    let minValue = Infinity;
    let maxValue = -Infinity;

    // Parcourir tous les points de toutes les lignes visibles
    datasets.forEach(dataset => {
      dataset.data.forEach((value: number) => {
        if (value !== null && value !== undefined) {
          if (value < minValue) minValue = value;
          if (value > maxValue) maxValue = value;
        }
      });
    });

    // Si aucune valeur valide, retourner des valeurs par défaut
    if (minValue === Infinity || maxValue === -Infinity) {
      return { min: 0, max: 1000 };
    }

    // Ajouter des marges (10% en haut, 10% en bas)
    const range = maxValue - minValue;
    const margin = range * 0.1 || Math.abs(maxValue) * 0.1 || 100;

    return {
      min: minValue - margin,
      max: maxValue + margin,
    };
  }, []);

  // Créer les datasets pour les lignes
  const datasets = useMemo(() => 
    accounts.map((account, index) => ({
      label: account,
      data: balanceData[index] || [],
      borderColor: accountColors[account] || '#808080',
      backgroundColor: accountColors[account] || '#808080',
      borderWidth: 2,
      fill: false,
      tension: 0.4, // Lissage de la courbe
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: accountColors[account] || '#808080',
      pointBorderColor: isDarkMode ? '#1e293b' : '#ffffff',
      pointBorderWidth: 2,
    })), [accounts, balanceData, accountColors, isDarkMode]
  );

  // Calculer les limites initiales
  const initialLimits = useMemo(() => 
    calculateYAxisLimits(datasets), 
    [datasets, calculateYAxisLimits]
  );

  const options: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    scales: {
      x: {
        grid: {
          display: true,
          color: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          color: isDarkMode ? '#cbd5e1' : '#1e293b',
          maxRotation: granularity === 'day' ? 45 : granularity === 'week' ? 0 : 0,
          minRotation: granularity === 'day' ? 45 : 0,
          font: {
            size: 11,
          },
        },
      },
      y: {
        title: {
          display: true,
          text: t('dashboard.balance', 'Solde'),
          font: {
            size: 14,
            weight: 'bold',
          },
          color: isDarkMode ? '#cbd5e1' : '#1e293b',
        },
        min: initialLimits.min,
        max: initialLimits.max,
        grid: {
          color: isDarkMode 
            ? (context) => (context.tick.value === 0 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)')
            : (context) => (context.tick.value === 0 ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.05)'),
          lineWidth: (context) => (context.tick.value === 0 ? 2 : 1),
        },
        ticks: {
          color: isDarkMode ? '#cbd5e1' : '#1e293b',
          callback: function (value) {
            return formatCurrency(value as number);
          },
        },
      },
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        onClick: function (e, legendItem, legend) {
          // Appeler le comportement par défaut de Chart.js
          ChartJS.defaults.plugins.legend.onClick.call(this, e, legendItem, legend);
          
          const chart = legend.chart;
          if (!chart) return;
          
          // Filtrer les datasets visibles
          const visibleDatasets = chart.data.datasets.filter((_, index) => 
            !chart.getDatasetMeta(index).hidden
          );
          
          // Recalculer les limites avec les datasets visibles
          const newLimits = calculateYAxisLimits(visibleDatasets);
          
          // Mettre à jour les limites
          if (chart.options.scales && chart.options.scales.y) {
            chart.options.scales.y.min = newLimits.min;
            chart.options.scales.y.max = newLimits.max;
          }
          
          chart.update();
        },
        labels: {
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle',
          font: {
            size: 11,
          },
          color: isDarkMode ? '#cbd5e1' : '#1e293b',
        },
      },
      tooltip: {
        backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: isDarkMode ? '#e2e8f0' : '#333',
        bodyColor: isDarkMode ? '#cbd5e1' : '#666',
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: function (context) {
            const label = context.dataset.label || '';
            if (context.parsed.y !== null) {
              return `${label}: ${formatCurrency(context.parsed.y)}`;
            }
            return label;
          },
        },
      },
    },
  }), [initialLimits, calculateYAxisLimits, isDarkMode, granularity, t]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Line
        ref={chartRef}
        data={{
          labels: periods,
          datasets: datasets,
        }}
        options={options}
      />
    </div>
  );
};

export default AccountBalanceLineChart;
