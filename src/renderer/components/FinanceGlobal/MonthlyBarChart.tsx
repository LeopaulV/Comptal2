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
  barPercentage?: number;
  categoryPercentage?: number;
  yAxisID?: string;
  pointRadius?: number;
  pointHoverRadius?: number;
  fill?: boolean;
  tension?: number;
};

ChartJS.register(...registerables);

interface MonthlyBarChartProps {
  months: string[];
  categories: string[];
  monthlyData: number[][];
  categoryColors: Record<string, string>;
}

const MonthlyBarChart: React.FC<MonthlyBarChartProps> = ({
  months,
  categories,
  monthlyData,
  categoryColors,
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
  // Utilise la même logique que Comptal1 : 10% de marge au-dessus, 40% en-dessous
  const calculateYAxisLimits = useCallback((datasets: MixedDataset[]) => {
    const numMonths = datasets[0]?.data.length || 0;
    const monthlyTotals: { positive: number; negative: number }[] = [];
    
    // Calculer les totaux mensuels pour le négatif et la somme des valeurs positives
    // Exclure la ligne de total (type 'line') du calcul
    for (let monthIndex = 0; monthIndex < numMonths; monthIndex++) {
      let positiveSum = 0;
      let negativeSum = 0;
      
      datasets.forEach(dataset => {
        // Exclure les datasets de type 'line' (ligne de total)
        if (dataset.type === 'line') {
          return;
        }
        
        const value = dataset.data[monthIndex];
        if (value > 0) {
          positiveSum += value; // Somme de tous les montants positifs du mois
        } else {
          negativeSum += value; // Somme de tous les montants négatifs du mois
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
    
    // Calculer la plage
    const range = maxPositive - minNegative;
    
    // Ajouter une marge en fonction de la plage
    const topMargin = range * 0.02;
    const bottomMargin = range * 0.02;
    const adjustedYMin = minNegative - bottomMargin;
    const adjustedYMax = maxPositive + topMargin;
    
    return { min: adjustedYMin, max: adjustedYMax };
  }, []);

  // Calculer les totaux mensuels
  const monthlyTotals = useMemo(() => 
    monthlyData[0].map((_, monthIndex) =>
      monthlyData.reduce((total, category) => total + (category[monthIndex] || 0), 0)
    ), [monthlyData]
  );

  // Créer les datasets pour les barres
  const barDatasets: MixedDataset[] = useMemo(() => 
    categories.map((category, index) => ({
      label: category,
      data: monthlyData[index],
      backgroundColor: categoryColors[category] || '#808080',
      borderColor: 'rgba(0, 0, 0, 0.3)',
      borderWidth: 1,
      type: 'bar' as const,
      order: 1,
      barPercentage: 0.98,
      categoryPercentage: 0.98,
    })), [categories, monthlyData, categoryColors]
  );

  // Dataset pour la ligne de total
  const lineDataset: MixedDataset = useMemo(() => ({
    label: t('financeGlobal.total'),
    data: monthlyTotals,
    backgroundColor: monthlyTotals.map(value =>
      value >= 0 ? 'rgba(40, 167, 69, 0.6)' : 'rgba(220, 53, 69, 0.6)'
    ),
    borderColor: monthlyTotals.map(value =>
      value >= 0 ? 'rgba(40, 167, 69, 0.8)' : 'rgba(220, 53, 69, 0.8)'
    ),
    borderWidth: 2,
    type: 'line' as const,
    yAxisID: 'y',
    pointRadius: 6,
    pointHoverRadius: 8,
    fill: false,
    order: 0,
    tension: 0.4,
  }), [monthlyTotals]);

  // Calculer les limites initiales
  const initialLimits = useMemo(() => 
    calculateYAxisLimits([...barDatasets, lineDataset]), 
    [barDatasets, lineDataset, calculateYAxisLimits]
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
          font: {
            size: 11,
            weight: 'bold',
          },
          color: isDarkMode ? '#cbd5e1' : '#1e293b',
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        stacked: true,
        position: 'left',
        title: {
          display: true,
          text: t('dashboard.expensesByCategory'),
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
        display: true,
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
        titleFont: {
          size: 13,
          weight: 'bold',
        },
        bodyColor: isDarkMode ? '#cbd5e1' : '#666',
        bodyFont: {
          size: 12,
        },
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: function (context) {
            const label = context.dataset.label || '';
            if (context.parsed.y !== null) {
              return `${label}: ${formatCurrency(Math.abs(context.parsed.y))}`;
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
          datasets: [...barDatasets, lineDataset] as any,
        }}
        options={options}
      />
    </div>
  );
};

export default MonthlyBarChart;

