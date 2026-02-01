import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { Facture } from '../../../types/Invoice';
import { Transaction } from '../../../types/Transaction';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface InvoiceVsPaymentChartProps {
  factures: Facture[];
  transactions: Transaction[];
}

interface MonthlyData {
  month: string;
  invoicesAmount: number;
  paymentsAmount: number;
}

const InvoiceVsPaymentChart: React.FC<InvoiceVsPaymentChartProps> = ({ factures, transactions }) => {
  const { t } = useTranslation();
  const [isDarkMode, setIsDarkMode] = useState(() => 
    document.documentElement.classList.contains('dark')
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastIsDarkRef = useRef<boolean>(
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      // Debounce pour éviter les mises à jour trop fréquentes
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        const nextIsDark = document.documentElement.classList.contains('dark');
        if (nextIsDark !== lastIsDarkRef.current) {
          lastIsDarkRef.current = nextIsDark;
          setIsDarkMode(nextIsDark);
        }
      }, 100);
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => {
      observer.disconnect();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const monthlyData = useMemo(() => {
    const dataMap = new Map<string, MonthlyData>();

    // Grouper les factures par mois
    factures.forEach((facture) => {
      const date = new Date(facture.dateEmission);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!dataMap.has(monthKey)) {
        dataMap.set(monthKey, {
          month: monthKey,
          invoicesAmount: 0,
          paymentsAmount: 0
        });
      }
      
      const data = dataMap.get(monthKey)!;
      data.invoicesAmount += facture.totalTTC;
    });

    // Grouper les paiements (via les factures) par mois
    factures.forEach((facture) => {
      facture.paiements.forEach((paiement) => {
        const date = new Date(paiement.datePaiement);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!dataMap.has(monthKey)) {
          dataMap.set(monthKey, {
            month: monthKey,
            invoicesAmount: 0,
            paymentsAmount: 0
          });
        }
        
        const data = dataMap.get(monthKey)!;
        data.paymentsAmount += paiement.montant;
      });
    });

    // Les transactions sont déjà comptées via les paiements des factures ci-dessus
    // Cette section pourrait être utilisée pour ajouter des transactions non liées,
    // mais pour l'instant, on se concentre uniquement sur les paiements des factures

    // Trier par date et retourner
    return Array.from(dataMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12); // Garder les 12 derniers mois
  }, [factures, transactions]);

  // Formater les labels de mois
  const monthLabels = useMemo(() => {
    return monthlyData.map(data => {
      const [year, month] = data.month.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    });
  }, [monthlyData]);

  // Couleurs selon le thème - mémorisées pour éviter les re-rendus
  const colors = useMemo(() => ({
    invoiceColor: isDarkMode ? '#60a5fa' : '#1e3a8a', // Bleu professionnel
    paymentColor: isDarkMode ? '#cbd5e1' : '#e2e8f0', // Gris
  }), [isDarkMode]);

  const chartData = useMemo(() => ({
    labels: monthLabels,
    datasets: [
      {
        label: t('invoicing.charts.invoicesIssued', 'Factures émises'),
        data: monthlyData.map(d => d.invoicesAmount),
        backgroundColor: colors.invoiceColor,
        borderColor: colors.invoiceColor,
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: t('invoicing.charts.paymentsReceived', 'Paiements perçus'),
        data: monthlyData.map(d => d.paymentsAmount),
        backgroundColor: colors.paymentColor,
        borderColor: colors.paymentColor,
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }), [monthlyData, monthLabels, colors, t]);

  const options: ChartOptions<'bar'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    // Désactiver complètement les animations pour éviter les violations requestAnimationFrame
    animation: false,
    // Désactiver aussi les animations de resize
    resizeDelay: 0,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          boxWidth: 12,
          padding: 15,
          font: {
            size: 12,
          },
          color: isDarkMode ? '#cbd5e1' : '#1e293b',
        },
      },
      tooltip: {
        enabled: true,
        animation: false, // Désactiver l'animation du tooltip
        backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: isDarkMode ? '#e2e8f0' : '#333',
        bodyColor: isDarkMode ? '#cbd5e1' : '#666',
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y || 0;
            return `${label}: ${value.toFixed(2)} €`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: isDarkMode ? '#94a3b8' : '#64748b',
          font: {
            size: 11,
          },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: isDarkMode ? 'rgba(148, 163, 184, 0.1)' : 'rgba(203, 213, 225, 0.5)',
        },
        ticks: {
          color: isDarkMode ? '#94a3b8' : '#64748b',
          font: {
            size: 11,
          },
          callback: function(value) {
            return `${value} €`;
          },
        },
      },
    },
  }), [isDarkMode]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default InvoiceVsPaymentChart;
