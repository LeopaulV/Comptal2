import React, { useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { formatCurrency } from '../../utils/format';

ChartJS.register(ArcElement, Tooltip, Legend);

export interface DonateurDetail {
  id: string;
  name: string;
  amount: number;
  color: string;
}

interface DonateurDrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  donateurs: DonateurDetail[];
}

const DonateurDrillDownModal: React.FC<DonateurDrillDownModalProps> = ({
  isOpen,
  onClose,
  title,
  donateurs,
}) => {
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
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const chartData = useMemo(() => {
    if (donateurs.length === 0) {
      return {
        labels: [t('projectManagement.charts.noData', 'Aucune donnée')],
        datasets: [
          {
            data: [1],
            backgroundColor: ['#cbd5e1'],
            borderColor: ['#cbd5e1'],
            borderWidth: 2,
          },
        ],
      };
    }

    return {
      labels: donateurs.map((d) => d.name),
      datasets: [
        {
          data: donateurs.map((d) => Math.abs(d.amount)),
          backgroundColor: donateurs.map((d) => d.color),
          borderColor: donateurs.map((d) => d.color),
          borderWidth: 2,
        },
      ],
    };
  }, [donateurs, t]);

  const options: ChartOptions<'pie'> = useMemo(() => {
    const total = donateurs.reduce((sum, d) => sum + Math.abs(d.amount), 0);

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right' as const,
          labels: {
            boxWidth: 15,
            padding: 15,
            font: { size: 12 },
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
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
              return `${label}: ${formatCurrency(value)} (${percentage}%)`;
            },
          },
        },
      },
      animation: {
        animateScale: true,
        animateRotate: true,
      },
    };
  }, [isDarkMode, t, donateurs]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
            aria-label={t('common.close', 'Fermer')}
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto mb-4">
          <div
            style={{
              width: '100%',
              height: '400px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Pie data={chartData} options={options} />
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {t('common.close', 'Fermer')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DonateurDrillDownModal;
