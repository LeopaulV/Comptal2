import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Doughnut, getElementAtEvent } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { formatCurrency } from '../../../utils/format';
import { useZoom } from '../../../hooks/useZoom';
import { Donateur } from '../../../types/Association';
import { Transaction } from '../../../types/Transaction';
import { CategoriesConfig } from '../../../types/Category';
import { Project, CategoryChargesData } from '../../../types/ProjectManagement';
import { ProjectionService } from '../../../services/ProjectionService';
import { eachDayOfInterval, startOfDay } from 'date-fns';
import { lightenColor, darkenColor } from '../../../utils/colorPalettes';
import type { DonateurDetail } from '../DonateurDrillDownModal';

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = ['#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981'];

interface DebitSegment {
  lineId: string;
  lineName: string;
  color: string;
  totalAmount: number;
  subscriptions: { id: string; name: string; amount: number; color: string }[];
  type: 'debit';
  isGroup: boolean;
}

interface DonateurSegment {
  lineId: string;
  lineName: string;
  color: string;
  totalAmount: number;
  donateurs: DonateurDetail[];
  type: 'donateur';
}

function getDonateurLabel(d: Donateur): string {
  if (d.type === 'entreprise') {
    return d.denominationSociale || d.siren || 'Entreprise';
  }
  const parts = [d.civilite, d.nom, d.prenom].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Particulier';
}

interface DonCategoryDistributionChartProps {
  donateurs: Donateur[];
  linkedTransactions: Transaction[];
  transactionMapping: Record<string, string>;
  categories: CategoriesConfig;
  project: Project | null;
  categoryChargesData?: CategoryChargesData | null;
  onOpenDrillDown?: (title: string, donateurs: DonateurDetail[]) => void;
}

const DonCategoryDistributionChart: React.FC<DonCategoryDistributionChartProps> = ({
  donateurs,
  linkedTransactions,
  transactionMapping,
  categories,
  project,
  categoryChargesData,
  onOpenDrillDown,
}) => {
  const { t } = useTranslation();
  const { zoomLevel } = useZoom();
  const chartRef = useRef<ChartJS<'doughnut'>>(null);
  const [isDarkMode, setIsDarkMode] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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

  const segmentsData = useMemo((): {
    debitSegments: DebitSegment[];
    donateurSegment: DonateurSegment | null;
  } => {
    const debitMap = new Map<string, DebitSegment>();
    const processedLineIds = new Set<string>();

    if (categoryChargesData && categoryChargesData.categories.length > 0) {
      for (const cat of categoryChargesData.categories) {
        if (cat.total > 0) {
          debitMap.set(cat.code, {
            lineId: cat.code,
            lineName: cat.name,
            color: cat.color,
            totalAmount: cat.total,
            subscriptions: [{ id: cat.code, name: cat.name, amount: -cat.total, color: cat.color }],
            type: 'debit',
            isGroup: false,
          });
        }
      }
    } else if (project && project.subscriptions.length > 0) {
      const startDate = startOfDay(project.projectionConfig.startDate);
      const endDate = startOfDay(project.projectionConfig.endDate);
      const dates = eachDayOfInterval({ start: startDate, end: endDate });

      for (const subscription of project.subscriptions) {
        if (subscription.isGroup && subscription.children && subscription.children.length > 0) {
          const groupLines = ProjectionService.getAllGroupLines(subscription);
          if (groupLines.length === 0) continue;

          let groupTotalAmount = 0;
          const groupSubscriptions: { id: string; name: string; amount: number; color: string }[] = [];
          const usedColors = new Map<string, number>();

          for (const line of groupLines) {
            processedLineIds.add(line.id);
            let lineTotalAmount = 0;
            for (const date of dates) {
              const amount = ProjectionService.applySubscriptionToDate(line, date);
              if (amount !== 0) lineTotalAmount += Math.abs(amount);
            }

            if (lineTotalAmount > 0 && line.type === 'debit') {
              groupTotalAmount += lineTotalAmount;
              const categoryCode = line.categoryCode || '__uncategorized__';
              let baseColor = line.color || categories[categoryCode]?.color || '#0ea5e9';
              let lineColor = baseColor;
              let adjustAmount = 0.15;
              const adjustColor = isDarkMode ? lightenColor : darkenColor;
              while (usedColors.has(lineColor)) {
                lineColor = adjustColor(baseColor, adjustAmount);
                adjustAmount += 0.15;
                if (adjustAmount > 0.6) break;
              }
              usedColors.set(lineColor, 1);
              groupSubscriptions.push({
                id: line.id,
                name: line.name,
                amount: -lineTotalAmount,
                color: lineColor,
              });
            }
          }

          if (groupTotalAmount > 0 && groupSubscriptions.length > 0) {
            const groupCategoryCode = subscription.categoryCode || '__uncategorized__';
            const groupColor = subscription.color || categories[groupCategoryCode]?.color || '#0ea5e9';
            debitMap.set(subscription.id, {
              lineId: subscription.id,
              lineName: subscription.name,
              color: groupColor,
              totalAmount: groupTotalAmount,
              subscriptions: groupSubscriptions,
              type: 'debit',
              isGroup: true,
            });
          }
        } else if (
          !subscription.isGroup &&
          !processedLineIds.has(subscription.id) &&
          subscription.type === 'debit'
        ) {
          let totalAmount = 0;
          for (const date of dates) {
            const amount = ProjectionService.applySubscriptionToDate(subscription, date);
            if (amount !== 0) totalAmount += Math.abs(amount);
          }

          if (totalAmount > 0) {
            const categoryCode = subscription.categoryCode || '__uncategorized__';
            const color = subscription.color || categories[categoryCode]?.color || '#0ea5e9';
            debitMap.set(subscription.id, {
              lineId: subscription.id,
              lineName: subscription.name,
              color,
              totalAmount,
              subscriptions: [
                { id: subscription.id, name: subscription.name, amount: -totalAmount, color },
              ],
              type: 'debit',
              isGroup: false,
            });
          }
        }
      }
    }

    const debitSegments = Array.from(debitMap.values())
      .filter((seg) => seg.totalAmount > 0)
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const donateurMap = new Map(donateurs.map((d) => [d.id, d]));
    const amountByDonateur = new Map<string, number>();

    for (const tx of linkedTransactions) {
      const donateurId = transactionMapping[tx.id];
      const donateur = donateurMap.get(donateurId);
      if (donateur) {
        amountByDonateur.set(
          donateur.id,
          (amountByDonateur.get(donateur.id) || 0) + tx.amount
        );
      }
    }

    const totalDons = Array.from(amountByDonateur.values()).reduce((a, b) => a + b, 0);
    let donateurSegment: DonateurSegment | null = null;

    if (totalDons > 0) {
      const donateursList: DonateurDetail[] = Array.from(amountByDonateur.entries())
        .map(([donateurId, amount], i) => {
          const d = donateurMap.get(donateurId)!;
          return {
            id: d.id,
            name: getDonateurLabel(d),
            amount: Math.round(amount * 100) / 100,
            color: categories[d.categoryCode || '']?.color || COLORS[i % COLORS.length],
          };
        })
        .sort((a, b) => b.amount - a.amount);

      donateurSegment = {
        lineId: '__donateur__',
        lineName: t('association.carousel.donateur', 'Donateur'),
        color: '#1e3a8a',
        totalAmount: totalDons,
        donateurs: donateursList,
        type: 'donateur',
      };
    }

    return { debitSegments, donateurSegment };
  }, [
    project,
    categoryChargesData,
    donateurs,
    linkedTransactions,
    transactionMapping,
    categories,
    isDarkMode,
    t,
  ]);

  const chartData = useMemo(() => {
    const { debitSegments, donateurSegment } = segmentsData;
    const allSegments = [
      ...debitSegments,
      ...(donateurSegment ? [donateurSegment] : []),
    ];

    if (allSegments.length === 0) {
      return {
        labels: [t('projectManagement.charts.noData', 'Aucune donnée')],
        datasets: [
          {
            data: [1],
            backgroundColor: ['#cbd5e1'],
            borderColor: ['#cbd5e1'],
            borderWidth: [2],
          },
        ],
      };
    }

    const totalDebit = debitSegments.reduce((sum, seg) => sum + seg.totalAmount, 0);
    const totalDonateur = donateurSegment?.totalAmount ?? 0;
    const grandTotal = totalDebit + totalDonateur;
    const separatorSize = grandTotal * 0.02;
    const needsSeparator = debitSegments.length > 0 && donateurSegment !== null;
    const separatorColor = isDarkMode ? '#1e293b' : '#f8fafc';

    const labels: string[] = [
      ...debitSegments.map((seg) => seg.lineName),
      ...(needsSeparator ? [''] : []),
      ...(donateurSegment ? [donateurSegment.lineName] : []),
      ...(needsSeparator ? [''] : []),
    ];

    const data: number[] = [
      ...debitSegments.map((seg) => seg.totalAmount),
      ...(needsSeparator ? [separatorSize] : []),
      ...(donateurSegment ? [donateurSegment.totalAmount] : []),
      ...(needsSeparator ? [separatorSize] : []),
    ];

    const backgroundColor: string[] = [
      ...debitSegments.map((seg) => seg.color),
      ...(needsSeparator ? [separatorColor] : []),
      ...(donateurSegment ? [donateurSegment.color] : []),
      ...(needsSeparator ? [separatorColor] : []),
    ];

    const borderColor: string[] = [
      ...debitSegments.map((seg) => seg.color),
      ...(needsSeparator ? [separatorColor] : []),
      ...(donateurSegment ? [donateurSegment.color] : []),
      ...(needsSeparator ? [separatorColor] : []),
    ];

    const borderWidth: number[] = [
      ...debitSegments.map(() => 2),
      ...(needsSeparator ? [0] : []),
      ...(donateurSegment ? [2] : []),
      ...(needsSeparator ? [0] : []),
    ];

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor,
          borderColor,
          borderWidth,
        },
      ],
    };
  }, [segmentsData, t, isDarkMode]);

  const getSegmentFromChartIndex = useCallback(
    (chartIndex: number): DebitSegment | DonateurSegment | null => {
      const { debitSegments, donateurSegment } = segmentsData;
      const needsSeparator = debitSegments.length > 0 && donateurSegment !== null;

      const separator1Index = debitSegments.length;
      const donateurIndex = needsSeparator ? debitSegments.length + 1 : debitSegments.length;
      const separator2Index = needsSeparator && donateurSegment
        ? debitSegments.length + 2
        : -1;

      if (needsSeparator && (chartIndex === separator1Index || chartIndex === separator2Index)) {
        return null;
      }

      if (chartIndex < debitSegments.length) {
        return debitSegments[chartIndex];
      }

      if (donateurSegment && chartIndex === donateurIndex) {
        return donateurSegment;
      }

      return null;
    },
    [segmentsData]
  );

  const options: ChartOptions<'doughnut'> = useMemo(() => {
    const { debitSegments, donateurSegment } = segmentsData;
    const totalDebit = debitSegments.reduce((sum, seg) => sum + seg.totalAmount, 0);
    const totalDonateur = donateurSegment?.totalAmount ?? 0;
    const needsSeparator = debitSegments.length > 0 && donateurSegment !== null;
    const separator1Index = debitSegments.length;

    return {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: typeof window !== 'undefined'
        ? Math.max(1, window.devicePixelRatio * (zoomLevel / 100))
        : 1,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            boxWidth: 15,
            padding: 12,
            font: { size: 11 },
            color: isDarkMode ? '#cbd5e1' : '#1e293b',
            filter: function (legendItem) {
              return legendItem.text !== '';
            },
          },
        },
        tooltip: {
          backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          titleColor: isDarkMode ? '#e2e8f0' : '#333',
          bodyColor: isDarkMode ? '#cbd5e1' : '#666',
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          borderWidth: 1,
          padding: 10,
          filter: function (tooltipItem) {
            const label = tooltipItem.label || '';
            return label !== '';
          },
          callbacks: {
            label: function (context) {
              const label = context.label || '';
              if (label === '') return [];
              const value = context.parsed || 0;
              const index = context.dataIndex;

              let realIndex = index;
              if (needsSeparator && index > separator1Index) {
                realIndex = index - 1;
              }

              const isDebit = realIndex < debitSegments.length;
              const total = isDebit ? totalDebit : totalDonateur;
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';

              const segment = isDebit
                ? debitSegments[realIndex]
                : donateurSegment;
              if (!segment) return [];

              const segmentLabel =
                segment.type === 'debit'
                  ? t('projectManagement.charts.debit', 'Débit')
                  : t('association.carousel.donateur', 'Donateur');
              const clickHint =
                segment.type === 'donateur' &&
                donateurSegment &&
                donateurSegment.donateurs.length > 0
                  ? ` - ${t('association.carousel.clickToViewDonateurs', 'Cliquez pour voir la répartition par donateur')}`
                  : '';

              return [
                `${label}: ${formatCurrency(value)}`,
                `${percentage}% ${segmentLabel}${clickHint}`,
              ];
            },
          },
        },
      },
      animation: {
        animateScale: true,
        animateRotate: true,
      },
      onHover: (_event, activeElements) => {
        if (activeElements.length > 0) {
          const index = activeElements[0].index;
          const segment = getSegmentFromChartIndex(index);
          if (segment && segment.type === 'donateur' && segment.donateurs.length > 0) {
            setHoveredIndex(index);
          } else {
            setHoveredIndex(null);
          }
        } else {
          setHoveredIndex(null);
        }
      },
    };
  }, [isDarkMode, t, segmentsData, getSegmentFromChartIndex, zoomLevel]);

  const handleChartClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!chartRef.current) return;

      const elements = getElementAtEvent(chartRef.current, event);
      if (elements.length === 0) return;

      const index = elements[0].index;
      const segment = getSegmentFromChartIndex(index);

      if (!segment) return;

      if (segment.type === 'donateur' && segment.donateurs.length > 0 && onOpenDrillDown) {
        const title = t('association.carousel.repartitionParDonateur', 'Répartition par donateur');
        onOpenDrillDown(title, segment.donateurs);
      }
    },
    [getSegmentFromChartIndex, onOpenDrillDown, t]
  );

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: hoveredIndex !== null ? 'pointer' : 'default',
      }}
    >
      <Doughnut ref={chartRef} data={chartData} options={options} onClick={handleChartClick} />
    </div>
  );
};

export default DonCategoryDistributionChart;
