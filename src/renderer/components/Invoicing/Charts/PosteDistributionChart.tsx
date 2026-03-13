import React, { useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { Devis, Facture, PosteFacture, PosteMateriel, PosteTravail } from '../../../types/Invoice';
import { InvoiceService } from '../../../services/InvoiceService';

ChartJS.register(ArcElement, Tooltip, Legend);

/** Bénéfice matériel = (prixUnitaire - coût) × quantité = part marge en € */
function beneficeMateriel(p: PosteMateriel): number {
  const base = p.prixUnitaireHT * p.quantite * (1 - (p.remise ?? 0) / 100);
  return (p.marge ?? 0) ? base * ((p.marge ?? 0) / 100) : 0;
}

/** Marge brute travail = total HT du poste (revenu service) */
function margeBruteTravail(p: PosteTravail): number {
  return InvoiceService.calculateLineHT(p);
}

interface PosteDistributionChartProps {
  devis?: Devis[];
  factures?: Facture[];
}

const PosteDistributionChart: React.FC<PosteDistributionChartProps> = ({ devis = [], factures = [] }) => {
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

  const typeBenefits = useMemo(() => {
    const benefits = { materiel: 0, travail: 0 };
    const collect = (postes: PosteFacture[]) => {
      for (const poste of postes) {
        if (poste.type === 'materiel') {
          benefits.materiel += beneficeMateriel(poste as PosteMateriel);
        } else {
          benefits.travail += margeBruteTravail(poste as PosteTravail);
        }
      }
    };
    devis.filter((d) => !d.supprime).forEach((d) => collect(d.postes));
    factures.filter((f) => !f.supprime).forEach((f) => collect(f.postes));
    return benefits;
  }, [devis, factures]);

  const chartData = useMemo(() => {
    const total = typeBenefits.materiel + typeBenefits.travail;
    const materielColor = isDarkMode ? '#60a5fa' : '#1e3a8a';
    const travailColor = isDarkMode ? '#93c5fd' : '#3b82f6';
    const noDataColor = isDarkMode ? '#64748b' : '#cbd5e1';

    if (total === 0) {
      return {
        labels: [t('invoicing.charts.noData', 'Aucune donnée')],
        datasets: [
          {
            data: [1],
            backgroundColor: [noDataColor],
            borderColor: [noDataColor],
            borderWidth: 2,
          },
        ],
      };
    }

    const materielLabel = t('invoicing.postes.materielTitle', 'Matériel');
    const travailLabel = t('invoicing.postes.travailTitle', 'Travail');

    return {
      labels: [materielLabel, travailLabel],
      datasets: [
        {
          data: [typeBenefits.materiel, typeBenefits.travail],
          backgroundColor: [materielColor, travailColor],
          borderColor: [materielColor, travailColor],
          borderWidth: 2,
        },
      ],
    };
  }, [typeBenefits, t, isDarkMode]);

  const options: ChartOptions<'doughnut'> = useMemo(() => {
    const total = typeBenefits.materiel + typeBenefits.travail;

    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
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
              const value = context.parsed || 0;
              if (total === 0) return context.label;
              const pct = ((value / total) * 100).toFixed(1);
              return `${context.label}: ${value.toFixed(2)} € (${pct}%)`;
            },
          },
        },
      },
      animation: {
        animateScale: true,
        animateRotate: true,
      },
    };
  }, [isDarkMode, typeBenefits, t]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Doughnut data={chartData} options={options} />
    </div>
  );
};

export default PosteDistributionChart;
