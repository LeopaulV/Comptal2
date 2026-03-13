import React, { useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chart as ChartJS, ChartOptions, registerables } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Devis } from '../../../types/Invoice';

ChartJS.register(...registerables);

interface PosteBreakdownChartProps {
  devis: Devis[];
}

const TOP_POSTES_LIMIT = 10;

const PosteBreakdownChart: React.FC<PosteBreakdownChartProps> = ({ devis = [] }) => {
  const { t } = useTranslation();
  const [isDarkMode, setIsDarkMode] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

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

  const designationData = useMemo(() => {
    const map = new Map<string, number>();
    const filteredDevis = devis.filter((d) => !d.supprime);
    for (const devisItem of filteredDevis) {
      for (const poste of devisItem.postes) {
        const key = poste.designation || t('invoicing.charts.unnamed', 'Sans nom');
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_POSTES_LIMIT);
  }, [devis, t]);

  const chartData = useMemo(() => {
    if (designationData.length === 0) {
      return {
        labels: [],
        datasets: [],
      };
    }

    const labels = designationData.map(([label]) => label);
    const data = designationData.map(([, count]) => count);
    const barColor = isDarkMode ? '#60a5fa' : '#1e3a8a';

    return {
      labels,
      datasets: [
        {
          label: t('invoicing.charts.occurrences', 'Occurrences'),
          data,
          backgroundColor: barColor,
          borderColor: barColor,
          borderWidth: 1,
        },
      ],
    };
  }, [designationData, t, isDarkMode]);

  const options: ChartOptions<'bar'> = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          right: 20,
        },
      },
      scales: {
        x: {
          grid: {
            display: true,
            color: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
          },
          ticks: {
            color: isDarkMode ? '#cbd5e1' : '#1e293b',
            maxRotation: 45,
            minRotation: 45,
            font: {
              size: 11,
            },
          },
          barPercentage: 0.6,
          categoryPercentage: 0.8,
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: t('invoicing.charts.occurrences', 'Occurrences'),
            font: {
              size: 14,
              weight: 'bold',
            },
            color: isDarkMode ? '#cbd5e1' : '#1e293b',
          },
          grid: {
            color: isDarkMode
              ? (context) =>
                  context.tick.value === 0 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'
              : (context) =>
                  context.tick.value === 0 ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.05)',
            lineWidth: (context) => (context.tick.value === 0 ? 2 : 1),
          },
          ticks: {
            color: isDarkMode ? '#cbd5e1' : '#1e293b',
            stepSize: 1,
          },
        },
      },
      plugins: {
        legend: {
          display: false,
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
              const value = context.parsed.y as number;
              return `${t('invoicing.charts.occurrences', 'Occurrences')}: ${value}`;
            },
          },
        },
      },
    };
  }, [isDarkMode, t]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: '300px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default PosteBreakdownChart;
