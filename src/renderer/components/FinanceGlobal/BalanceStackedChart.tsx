import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chart as ChartJS, ChartOptions, registerables } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { formatCurrency } from '../../utils/format';

// Type pour les datasets mixtes (barres + ligne)
type MixedDataset = {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  type?: 'bar' | 'line';
  order?: number;
  stack?: string;
  fill?: boolean;
  tension?: number;
  pointRadius?: number;
  pointHoverRadius?: number;
};

ChartJS.register(...registerables);

interface BalanceStackedChartProps {
  months: string[];
  accounts: string[];
  monthlyData: number[][];
  accountColors: Record<string, string>;
}

const BalanceStackedChart: React.FC<BalanceStackedChartProps> = ({
  months,
  accounts,
  monthlyData,
  accountColors,
}) => {
  const { t } = useTranslation();
  const chartRef = useRef<ChartJS<'bar'>>(null);
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
  const calculateYAxisLimits = useCallback((datasets: MixedDataset[]) => {
    const numMonths = datasets[0]?.data.length || 0;
    const monthlyTotals: { positive: number; negative: number }[] = [];
    
    // Calculer les totaux mensuels pour le négatif et la somme des valeurs positives
    // Exclure la courbe de tendance (type 'line') du calcul
    for (let monthIndex = 0; monthIndex < numMonths; monthIndex++) {
      let positiveSum = 0;
      let negativeSum = 0;
      
      datasets.forEach(dataset => {
        // Exclure les datasets de type 'line' (courbe de tendance)
        if (dataset.type === 'line') {
          return;
        }
        
        const value = dataset.data[monthIndex];
        if (value > 0) {
          positiveSum += value; // Somme de tous les soldes positifs du mois
        } else {
          negativeSum += value;
        }
      });
      
      monthlyTotals.push({
        positive: positiveSum,
        negative: negativeSum
      });
    }
    
    // Trouver la plus grande somme positive et la somme négative la plus basse
    const maxPositive = Math.max(...monthlyTotals.map(t => t.positive));
    const minNegative = Math.min(...monthlyTotals.map(t => t.negative));
    
    // Calculer les marges en fonction de la plus grande valeur positive et de la plus petite valeur négative
    const positiveMargin = maxPositive * 0.1;
    const negativeMargin = Math.abs(minNegative) * 0.1;
    
    return { min: minNegative - negativeMargin, max: maxPositive + positiveMargin };
  }, []);

  // Créer les datasets pour les barres
  const datasets: MixedDataset[] = useMemo(() => 
    accounts.map((account, index) => ({
      label: account,
      data: monthlyData[index],
      backgroundColor: accountColors[account] || '#808080',
      borderColor: 'rgba(0, 0, 0, 0.3)',
      borderWidth: 1,
      stack: 'stack',
      order: 2,
      type: 'bar' as const,
    })), [accounts, monthlyData, accountColors]
  );

  // Calculer le total cumulé pour chaque mois
  const totalSoldes = useMemo(() => 
    monthlyData[0].map((_, monthIndex) =>
      monthlyData.reduce((total, dataset) => total + (dataset[monthIndex] || 0), 0)
    ), [monthlyData]
  );

  // Calculer les valeurs de la ligne de tendance avec régression linéaire (y = a*x + b)
  const trendData = useMemo(() => {
    const n = totalSoldes.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += totalSoldes[i];
      sumXY += i * totalSoldes[i];
      sumX2 += i * i;
    }
    const a = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const b = (sumY - a * sumX) / n;
    
    const trendDataArray = [];
    for (let i = 0; i < n; i++) {
      trendDataArray.push(a * i + b);
    }
    
    return { trendData: trendDataArray, coefficient: a };
  }, [totalSoldes]);

  // Dataset de la courbe de tendance
  const trendDataset: MixedDataset = useMemo(() => ({
    label: t('chart.trendLine', { coefficient: trendData.coefficient.toFixed(2) }),
    data: trendData.trendData,
    type: 'line' as const,
    fill: false,
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 0,
    tension: 0,
    order: 1,
    stack: 'trend',
  }), [trendData, isDarkMode]);

  // Calculer les limites initiales
  const initialLimits = useMemo(() => 
    calculateYAxisLimits([...datasets, trendDataset]), 
    [datasets, trendDataset, calculateYAxisLimits]
  );

  const options: ChartOptions<'bar'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        grid: {
          display: false,
        },
        ticks: {
          color: isDarkMode ? '#cbd5e1' : '#1e293b',
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        stacked: true,
        title: {
          display: true,
          text: t('financeGlobal.currentBalance'),
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
        position: 'bottom',
        onClick: function (e, legendItem, legend) {
          // Appeler le comportement par défaut de Chart.js
          ChartJS.defaults.plugins.legend.onClick.call(this, e, legendItem, legend);
          
          const chart = legend.chart;
          if (!chart) return;
          
          // Filtrer les datasets visibles
          const visibleDatasets = chart.data.datasets.filter((_, index) => 
            !chart.getDatasetMeta(index).hidden
          );
          
          // Utiliser la même fonction pour recalculer les limites
          const newLimits = calculateYAxisLimits(visibleDatasets as MixedDataset[]);
          
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
  }), [initialLimits, calculateYAxisLimits, isDarkMode]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Bar
        ref={chartRef}
        data={{
          labels: months,
          datasets: [...datasets, trendDataset] as any,
        }}
        options={options}
      />
    </div>
  );
};

export default BalanceStackedChart;

