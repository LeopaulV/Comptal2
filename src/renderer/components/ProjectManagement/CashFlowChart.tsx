import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chart as ChartJS, ChartOptions, registerables } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { formatCurrency } from '../../utils/format';
import { ProjectionData } from '../../types/ProjectManagement';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

ChartJS.register(...registerables);

interface CashFlowChartProps {
  data: ProjectionData[];
}

const CashFlowChart: React.FC<CashFlowChartProps> = ({ data }) => {
  const { t } = useTranslation();
  const chartRef = useRef<ChartJS<'line'>>(null);
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

  const chartData = useMemo(() => {
    // Agréger par mois pour réduire le nombre de points
    const monthlyData: Map<string, number> = new Map();
    
    for (const point of data) {
      const monthKey = format(point.date, 'yyyy-MM');
      // Prendre le dernier solde du mois
      monthlyData.set(monthKey, point.balance);
    }
    
    const sortedMonths = Array.from(monthlyData.keys()).sort();
    
    return {
      labels: sortedMonths.map(month => {
        const date = new Date(month + '-01');
        return format(date, 'MMM yyyy', { locale: fr });
      }),
      datasets: [
        {
          label: t('projectManagement.charts.cashFlow', 'Solde projeté'),
          data: sortedMonths.map(month => monthlyData.get(month) || 0),
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14, 165, 233, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#0ea5e9',
          pointBorderColor: isDarkMode ? '#1e293b' : '#ffffff',
          pointBorderWidth: 2,
        },
      ],
    };
  }, [data, isDarkMode, t]);

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
          maxRotation: 45,
          minRotation: 45,
          font: {
            size: 11,
          },
        },
      },
      y: {
        title: {
          display: true,
          text: t('projectManagement.charts.balance', 'Solde'),
          font: {
            size: 14,
            weight: 'bold',
          },
          color: isDarkMode ? '#cbd5e1' : '#1e293b',
        },
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
        position: 'top' as const,
        labels: {
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle',
          font: {
            size: 12,
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
  }), [isDarkMode, t]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <Line
        ref={chartRef}
        data={chartData}
        options={options}
      />
    </div>
  );
};

export default CashFlowChart;
