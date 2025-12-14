import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { formatCurrency } from '../../utils/format';

ChartJS.register(ArcElement, Tooltip, Legend);

interface IncomePieChartProps {
  income: number;
  expenses: number;
}

const IncomePieChart: React.FC<IncomePieChartProps> = ({ income, expenses }) => {
  const { t } = useTranslation();
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

  // Couleurs harmonisées avec la palette corporate professionnelle qui s'adaptent au thème
  const incomeColor = isDarkMode ? '#60a5fa' : '#1e3a8a'; // Bleu adapté au thème
  const expensesColor = isDarkMode ? '#cbd5e1' : '#e2e8f0'; // Gris adapté au thème

  const chartData = {
    labels: [t('chart.incomeLabel'), t('chart.expensesLabel')],
    datasets: [
      {
        data: [income, Math.abs(expenses)],
        backgroundColor: [incomeColor, expensesColor],
        borderColor: [incomeColor, expensesColor],
        borderWidth: 2,
      },
    ],
  };

  const options: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          boxWidth: 15,
          padding: 15,
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
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = income + Math.abs(expenses);
            const percentage = ((value / total) * 100).toFixed(1);
            return t('chart.tooltipLabelWithPercentage', { label, value: formatCurrency(value), percentage });
          },
        },
      },
    },
    animation: {
      animateScale: true,
      animateRotate: true,
    },
  };

  return (
    <div style={{ width: '100%', height: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Pie data={chartData} options={options} />
    </div>
  );
};

export default IncomePieChart;

