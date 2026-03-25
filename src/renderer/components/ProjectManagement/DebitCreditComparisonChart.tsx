import React, { useMemo, useEffect, useState } from 'react';
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
import { ProjectionData } from '../../types/ProjectManagement';

ChartJS.register(ArcElement, Tooltip, Legend);

interface DebitCreditComparisonChartProps {
  data: ProjectionData[];
}

const DebitCreditComparisonChart: React.FC<DebitCreditComparisonChartProps> = ({ data }) => {
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

  // Couleurs harmonisées avec la palette corporate professionnelle qui s'adaptent au thème
  const creditsColor = isDarkMode ? '#60a5fa' : '#1e3a8a'; // Bleu adapté au thème
  const debitsColor = isDarkMode ? '#cbd5e1' : '#e2e8f0'; // Gris adapté au thème

  const chartData = useMemo(() => {
    // Calculer les totaux : crédits > 0, débits stockés en négatif
    const totalDebits = data.reduce((sum, d) => sum + d.totalDebits, 0);
    const totalCredits = data.reduce((sum, d) => sum + d.totalCredits, 0);
    const absDebits = Math.abs(totalDebits);
    
    return {
      labels: [
        t('projectManagement.charts.credits', 'Crédits'),
        t('projectManagement.charts.debits', 'Débits')
      ],
      datasets: [
        {
          data: [totalCredits, absDebits], // Pie en valeurs positives, débits affichés en négatif dans tooltip
          backgroundColor: [creditsColor, debitsColor],
          borderColor: [creditsColor, debitsColor],
          borderWidth: 2,
        },
      ],
    };
  }, [data, t, creditsColor, debitsColor]);

  const options: ChartOptions<'pie'> = useMemo(() => {
    const totalDebits = data.reduce((sum, d) => sum + d.totalDebits, 0);
    const totalCredits = data.reduce((sum, d) => sum + d.totalCredits, 0);
    const absDebits = Math.abs(totalDebits);
    const total = totalCredits + absDebits;

    return {
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
              const raw = context.parsed || 0;
              const value = context.dataIndex === 1 ? -raw : raw; // Débits affichés en négatif
              const percentage = total > 0 ? ((raw / total) * 100).toFixed(1) : '0.0';
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
  }, [isDarkMode, t, data]);

  return (
    <div style={{ width: '100%', height: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Pie data={chartData} options={options} />
    </div>
  );
};

export default DebitCreditComparisonChart;
