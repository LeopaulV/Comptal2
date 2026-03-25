import React, { useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chart as ChartJS, ChartOptions, registerables } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Donateur } from '../../../types/Association';
import { Transaction } from '../../../types/Transaction';
import { Don } from '../../../types/Association';
import { useZoom } from '../../../hooks/useZoom';

ChartJS.register(...registerables);

const DONATEURS_PER_PAGE = 5;

/** Retourne la valeur d'une variable CSS (charte visuelle Comptal2) */
function getChartColor(cssVar: string): string {
  if (typeof document === 'undefined') return '#1e3a8a';
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return value || '#1e3a8a';
}

interface TopDonateursChartProps {
  donateurs: Donateur[];
  linkedTransactions: Transaction[];
  transactionMapping: Record<string, string>;
  dons: Don[];
}

function getDonateurLabel(d: Donateur): string {
  if (d.type === 'entreprise') {
    return d.denominationSociale || d.siren || 'Entreprise';
  }
  const parts = [d.civilite, d.nom, d.prenom].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Particulier';
}

/** Montants par donateur et par type de don (numéraire = transactions + dons numéraire, nature, mécénat) */
interface DonateurBreakdown {
  donateurId: string;
  label: string;
  numeraire: number;
  nature: number;
  mecenat_competences: number;
  total: number;
}

const TopDonateursChart: React.FC<TopDonateursChartProps> = ({
  donateurs,
  linkedTransactions,
  transactionMapping,
  dons,
}) => {
  const { t } = useTranslation();
  const { zoomLevel } = useZoom();
  const [pageIndex, setPageIndex] = useState(0);
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

  const donateurBreakdowns = useMemo((): DonateurBreakdown[] => {
    const donateurMap = new Map(donateurs.map((d) => [d.id, d]));
    const breakdownByDonateur = new Map<
      string,
      { numeraire: number; nature: number; mecenat_competences: number }
    >();

    for (const tx of linkedTransactions) {
      const donateurId = transactionMapping[tx.id];
      if (!donateurId || !donateurMap.has(donateurId)) continue;
      const cur = breakdownByDonateur.get(donateurId) ?? {
        numeraire: 0,
        nature: 0,
        mecenat_competences: 0,
      };
      cur.numeraire += tx.amount;
      breakdownByDonateur.set(donateurId, cur);
    }

    for (const don of dons) {
      if (don.donateurId === 'ANONYME') continue;
      if (!donateurMap.has(don.donateurId)) continue;
      const cur = breakdownByDonateur.get(don.donateurId) ?? {
        numeraire: 0,
        nature: 0,
        mecenat_competences: 0,
      };
      const montant = don.montant;
      if (don.natureDon === 'numeraire') cur.numeraire += montant;
      else if (don.natureDon === 'nature') cur.nature += montant;
      else if (don.natureDon === 'mecenat_competences') cur.mecenat_competences += montant;
      breakdownByDonateur.set(don.donateurId, cur);
    }

    return Array.from(breakdownByDonateur.entries())
      .map(([donateurId, amounts]) => {
        const d = donateurMap.get(donateurId)!;
        const total =
          amounts.numeraire + amounts.nature + amounts.mecenat_competences;
        return {
          donateurId,
          label: getDonateurLabel(d),
          numeraire: Math.round(amounts.numeraire * 100) / 100,
          nature: Math.round(amounts.nature * 100) / 100,
          mecenat_competences: Math.round(amounts.mecenat_competences * 100) / 100,
          total,
        };
      })
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [donateurs, linkedTransactions, transactionMapping, dons]);

  const pageCount = Math.max(
    1,
    Math.ceil(donateurBreakdowns.length / DONATEURS_PER_PAGE)
  );
  const currentPage = Math.min(pageIndex, pageCount - 1);
  const pageDonateurs = useMemo(() => {
    const start = currentPage * DONATEURS_PER_PAGE;
    return donateurBreakdowns.slice(start, start + DONATEURS_PER_PAGE);
  }, [donateurBreakdowns, currentPage]);

  const chartData = useMemo(() => {
    if (pageDonateurs.length === 0) {
      return {
        labels: [] as string[],
        datasets: [] as { label: string; data: number[]; backgroundColor: string; borderColor: string; borderWidth: number }[],
      };
    }

    const labels = pageDonateurs.map((d) => d.label);
    const numeraireData = pageDonateurs.map((d) => d.numeraire);
    const natureData = pageDonateurs.map((d) => d.nature);
    const mecenatData = pageDonateurs.map((d) => d.mecenat_competences);

    /* Variantes de bleu (charte visuelle) – Mécénat en bleu clair */
    const colors = {
      numeraire: getChartColor('--invoicing-primary'),
      nature: getChartColor('--invoicing-primary-light'),
      mecenat: getChartColor('--invoicing-primary-lightest'),
    };

    return {
      labels,
      datasets: [
        {
          label: t('association.carousel.typeNumeraire', 'Numéraire'),
          data: numeraireData,
          backgroundColor: colors.numeraire,
          borderColor: colors.numeraire,
          borderWidth: 1,
        },
        {
          label: t('association.carousel.typeNature', 'Don en nature'),
          data: natureData,
          backgroundColor: colors.nature,
          borderColor: colors.nature,
          borderWidth: 1,
        },
        {
          label: t('association.carousel.typeMecenat', 'Mécénat'),
          data: mecenatData,
          backgroundColor: colors.mecenat,
          borderColor: colors.mecenat,
          borderWidth: 1,
        },
      ],
    };
  }, [pageDonateurs, isDarkMode, t]);

  const options: ChartOptions<'bar'> = useMemo(() => {
    const dpr = typeof window !== 'undefined'
      ? Math.max(1, window.devicePixelRatio * (zoomLevel / 100))
      : 1;
    return {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: dpr,
      indexAxis: 'y' as const,
      scales: {
        x: {
          stacked: true,
          beginAtZero: true,
          title: {
            display: true,
            text: t('association.carousel.montantDons', 'Montant des dons'),
            font: { size: 12, weight: 'bold' },
            color: isDarkMode ? '#cbd5e1' : '#1e293b',
          },
          grid: {
            color: isDarkMode
              ? (ctx: { tick: { value: number } }) =>
                  ctx.tick.value === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)'
              : (ctx: { tick: { value: number } }) =>
                  ctx.tick.value === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
            lineWidth: (ctx: { tick: { value: number } }) =>
              ctx.tick.value === 0 ? 2 : 1,
          },
          ticks: {
            color: isDarkMode ? '#cbd5e1' : '#1e293b',
            callback: (value: string | number) => `${value} €`,
          },
        },
        y: {
          stacked: true,
          grid: {
            display: true,
            color: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
          },
          ticks: {
            color: isDarkMode ? '#cbd5e1' : '#1e293b',
            font: { size: 11 },
          },
          barPercentage: 0.6,
          categoryPercentage: 0.8,
        },
      },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            boxWidth: 14,
            padding: 12,
            font: { size: 11 },
            color: isDarkMode ? '#cbd5e1' : '#1e293b',
          },
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          backgroundColor: isDarkMode ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)',
          titleColor: isDarkMode ? '#e2e8f0' : '#333',
          bodyColor: isDarkMode ? '#cbd5e1' : '#666',
          borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (context) => {
              const value = context.parsed.x as number;
              if (value === 0) return undefined;
              return `${context.dataset.label}: ${value.toFixed(2)} €`;
            },
            footer: (items) => {
              if (items.length === 0) return [];
              const idx = items[0].dataIndex;
              const row = pageDonateurs[idx];
              if (!row) return [];
              return [`Total: ${row.total.toFixed(2)} €`];
            },
          },
        },
      },
    };
  }, [isDarkMode, t, pageDonateurs, zoomLevel]);

  if (donateurBreakdowns.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          minHeight: '300px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--invoicing-gray-500)',
        }}
      >
        {t('association.carousel.aucunDon', 'Aucun don enregistré')}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 8,
          flexShrink: 0,
        }}
      >
        <span className="invoicing-graph-pagination-label">
          {t('association.carousel.pageDonateurs', 'Donateurs {{start}}-{{end}} sur {{total}}', {
            start: currentPage * DONATEURS_PER_PAGE + 1,
            end: Math.min((currentPage + 1) * DONATEURS_PER_PAGE, donateurBreakdowns.length),
            total: donateurBreakdowns.length,
          })}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            className="invoicing-carousel-tab"
            disabled={currentPage === 0}
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            aria-label={t('common.previous', 'Précédent')}
          >
            ‹
          </button>
          <button
            type="button"
            className="invoicing-carousel-tab"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
            aria-label={t('common.next', 'Suivant')}
          >
            ›
          </button>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: '260px' }}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
};

export default TopDonateursChart;
