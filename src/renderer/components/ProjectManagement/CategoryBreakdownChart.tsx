import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Doughnut, getElementAtEvent } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { formatCurrency } from '../../utils/format';
import { Subscription, ProjectionConfig } from '../../types/ProjectManagement';
import { ProjectionService } from '../../services/ProjectionService';
import { eachDayOfInterval, startOfDay } from 'date-fns';
import { CategoriesConfig } from '../../types/Category';
import { lightenColor, darkenColor } from '../../utils/colorPalettes';

ChartJS.register(ArcElement, Tooltip, Legend);

interface SubscriptionDetail {
  id: string;
  name: string;
  amount: number;
  color: string;
}

interface DrillDownData {
  title: string;
  subscriptions: SubscriptionDetail[];
}

interface CategoryBreakdownChartProps {
  subscriptions: Subscription[];
  projectionConfig: ProjectionConfig;
  categories: CategoriesConfig;
  onOpenDrillDown?: (data: DrillDownData) => void;
}

interface LineSegment {
  lineId: string;
  lineName: string;
  color: string;
  totalAmount: number;
  subscriptions: SubscriptionDetail[];
  type: 'debit' | 'credit';
  isGroup: boolean;
}

const CategoryBreakdownChart: React.FC<CategoryBreakdownChartProps> = ({ 
  subscriptions, 
  projectionConfig,
  categories,
  onOpenDrillDown
}) => {
  const { t } = useTranslation();
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
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  const segmentsData = useMemo((): { debitSegments: LineSegment[]; creditSegments: LineSegment[] } => {
    const debitMap = new Map<string, LineSegment>();
    const creditMap = new Map<string, LineSegment>();
    const startDate = startOfDay(projectionConfig.startDate);
    const endDate = startOfDay(projectionConfig.endDate);
    const dates = eachDayOfInterval({ start: startDate, end: endDate });
    const processedLineIds = new Set<string>(); // Pour éviter de traiter deux fois les lignes qui sont dans des groupes

    // Parcourir toutes les subscriptions (pas seulement les flat)
    for (const subscription of subscriptions) {
      // Si c'est un groupe, créer un segment avec toutes les lignes du groupe
      if (subscription.isGroup && subscription.children && subscription.children.length > 0) {
        const groupLines = ProjectionService.getAllGroupLines(subscription);
        
        if (groupLines.length === 0) {
          continue;
        }

        // Calculer le montant total du groupe et déterminer le type basé sur les lignes
        let groupTotalAmount = 0;
        const groupSubscriptions: SubscriptionDetail[] = [];
        const usedColors = new Map<string, number>(); // Pour tracker les couleurs utilisées et éclaircir si nécessaire
        let debitCount = 0;
        let creditCount = 0;

        for (const line of groupLines) {
          // Marquer cette ligne comme traitée
          processedLineIds.add(line.id);

          // Calculer le montant total de cette ligne
          let lineTotalAmount = 0;
          for (const date of dates) {
            const amount = ProjectionService.applySubscriptionToDate(line, date);
            if (amount !== 0) {
              lineTotalAmount += Math.abs(amount);
            }
          }

          if (lineTotalAmount > 0) {
            groupTotalAmount += lineTotalAmount;

            // Compter les types pour déterminer le type dominant du groupe
            if (line.type === 'debit') {
              debitCount++;
            } else {
              creditCount++;
            }

            // Obtenir la couleur de base de la ligne
            const categoryCode = line.categoryCode || '__uncategorized__';
            let baseColor = line.color || categories[categoryCode]?.color || '#0ea5e9';
            let lineColor = baseColor;

            // Si cette couleur est déjà utilisée dans le groupe, l'ajuster progressivement
            // Mode sombre : éclaircir, Mode clair : assombrir
            let adjustAmount = 0.15;
            const adjustColor = isDarkMode ? lightenColor : darkenColor;
            while (usedColors.has(lineColor)) {
              lineColor = adjustColor(baseColor, adjustAmount);
              adjustAmount += 0.15;
              // Limiter l'ajustement pour garder la couleur visible (max 0.6)
              if (adjustAmount > 0.6) {
                break;
              }
            }
            
            // Marquer cette couleur comme utilisée
            usedColors.set(lineColor, 1);

            groupSubscriptions.push({
              id: line.id,
              name: line.name,
              amount: line.type === 'debit' ? -lineTotalAmount : lineTotalAmount,
              color: lineColor,
            });
          }
        }

        if (groupTotalAmount > 0 && groupSubscriptions.length > 0) {
          // Obtenir la couleur de base du groupe (couleur de la catégorie du groupe ou couleur par défaut)
          const groupCategoryCode = subscription.categoryCode || '__uncategorized__';
          const groupColor = subscription.color || categories[groupCategoryCode]?.color || '#0ea5e9';

          // Déterminer le type du groupe basé sur le type dominant des lignes
          // Si toutes les lignes sont du même type, utiliser ce type
          // Sinon, utiliser le type du groupe parent comme fallback
          let type: 'debit' | 'credit';
          if (debitCount > 0 && creditCount === 0) {
            type = 'debit';
          } else if (creditCount > 0 && debitCount === 0) {
            type = 'credit';
          } else {
            // Si le groupe contient des lignes de types mixtes, utiliser le type du groupe parent
            type = subscription.type;
          }
          
          const targetMap = type === 'debit' ? debitMap : creditMap;

          targetMap.set(subscription.id, {
            lineId: subscription.id,
            lineName: subscription.name,
            color: groupColor,
            totalAmount: groupTotalAmount,
            subscriptions: groupSubscriptions,
            type,
            isGroup: true,
          });
        }
      } else if (!subscription.isGroup && !processedLineIds.has(subscription.id)) {
        // C'est une ligne individuelle qui n'a pas été traitée dans un groupe
        // Calculer le montant total sur toute la période
        let totalAmount = 0;
        for (const date of dates) {
          const amount = ProjectionService.applySubscriptionToDate(subscription, date);
          if (amount !== 0) {
            totalAmount += Math.abs(amount);
          }
        }

        if (totalAmount > 0) {
          const categoryCode = subscription.categoryCode || '__uncategorized__';
          const color = subscription.color || categories[categoryCode]?.color || '#0ea5e9';

          const type = subscription.type;
          const targetMap = type === 'debit' ? debitMap : creditMap;

          targetMap.set(subscription.id, {
            lineId: subscription.id,
            lineName: subscription.name,
            color,
            totalAmount,
            subscriptions: [{
              id: subscription.id,
              name: subscription.name,
              amount: subscription.type === 'debit' ? -totalAmount : totalAmount,
              color,
            }],
            type,
            isGroup: false,
          });
        }
      }
    }

    // Filtrer et trier les segments
    const debitSegments = Array.from(debitMap.values())
      .filter(seg => seg.totalAmount > 0)
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const creditSegments = Array.from(creditMap.values())
      .filter(seg => seg.totalAmount > 0)
      .sort((a, b) => b.totalAmount - a.totalAmount);

    return { debitSegments, creditSegments };
  }, [subscriptions, projectionConfig, categories, t, isDarkMode]);

  const chartData = useMemo(() => {
    const { debitSegments, creditSegments } = segmentsData;
    const allSegments = [...debitSegments, ...creditSegments];

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

    // Calculer le total pour déterminer la taille du séparateur
    const totalDebit = debitSegments.reduce((sum, seg) => sum + seg.totalAmount, 0);
    const totalCredit = creditSegments.reduce((sum, seg) => sum + seg.totalAmount, 0);
    const grandTotal = totalDebit + totalCredit;
    
    // Le séparateur représente environ 2% du total
    const separatorSize = grandTotal * 0.02;
    
    // Déterminer si on a besoin d'un ou deux séparateurs
    const needsSeparator = debitSegments.length > 0 && creditSegments.length > 0;
    
    // Couleur du séparateur (transparent ou couleur du fond selon le mode)
    const separatorColor = isDarkMode ? '#1e293b' : '#f8fafc';

    // Construire les données : débits, séparateur, crédits, séparateur (pour boucler)
    const labels: string[] = [
      ...debitSegments.map(seg => seg.lineName),
      ...(needsSeparator ? [''] : []), // Séparateur entre débits et crédits
      ...creditSegments.map(seg => seg.lineName),
      ...(needsSeparator ? [''] : []), // Séparateur pour boucler le cercle
    ];

    const data: number[] = [
      ...debitSegments.map(seg => seg.totalAmount),
      ...(needsSeparator ? [separatorSize] : []),
      ...creditSegments.map(seg => seg.totalAmount),
      ...(needsSeparator ? [separatorSize] : []),
    ];

    const backgroundColor: string[] = [
      ...debitSegments.map(seg => seg.color),
      ...(needsSeparator ? [separatorColor] : []),
      ...creditSegments.map(seg => seg.color),
      ...(needsSeparator ? [separatorColor] : []),
    ];

    const borderColor: string[] = [
      ...debitSegments.map(seg => seg.color),
      ...(needsSeparator ? [separatorColor] : []),
      ...creditSegments.map(seg => seg.color),
      ...(needsSeparator ? [separatorColor] : []),
    ];

    // Bordures : 2px pour tous, 0px pour les séparateurs
    const borderWidth: number[] = [
      ...debitSegments.map(() => 2),
      ...(needsSeparator ? [0] : []),
      ...creditSegments.map(() => 2),
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

  // Fonction pour convertir l'index du graphique vers l'index réel dans allSegments
  // (en tenant compte des séparateurs)
  const getSegmentFromChartIndex = useCallback((chartIndex: number): LineSegment | null => {
    const { debitSegments, creditSegments } = segmentsData;
    const needsSeparator = debitSegments.length > 0 && creditSegments.length > 0;
    
    // Index des séparateurs
    const separator1Index = debitSegments.length;
    const separator2Index = debitSegments.length + 1 + creditSegments.length;
    
    // Si c'est un séparateur, retourner null
    if (needsSeparator && (chartIndex === separator1Index || chartIndex === separator2Index)) {
      return null;
    }
    
    // Calculer l'index réel dans allSegments
    let realIndex = chartIndex;
    if (needsSeparator && chartIndex > separator1Index) {
      realIndex = chartIndex - 1; // Soustraire 1 pour le premier séparateur
    }
    
    const allSegments = [...debitSegments, ...creditSegments];
    if (realIndex >= 0 && realIndex < allSegments.length) {
      return allSegments[realIndex];
    }
    return null;
  }, [segmentsData]);

  const options: ChartOptions<'doughnut'> = useMemo(() => {
    const { debitSegments, creditSegments } = segmentsData;
    const totalDebit = debitSegments.reduce((sum, seg) => sum + seg.totalAmount, 0);
    const totalCredit = creditSegments.reduce((sum, seg) => sum + seg.totalAmount, 0);
    const needsSeparator = debitSegments.length > 0 && creditSegments.length > 0;
    const separator1Index = debitSegments.length;

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
            font: {
              size: 12,
            },
            color: isDarkMode ? '#cbd5e1' : '#1e293b',
            // Filtrer les séparateurs de la légende
            filter: function(legendItem) {
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
          // Ne pas afficher de tooltip pour les séparateurs
          filter: function(tooltipItem) {
            const label = tooltipItem.label || '';
            return label !== '';
          },
          callbacks: {
            label: function (context) {
              const label = context.label || '';
              // Ignorer les séparateurs
              if (label === '') return [];
              
              const value = context.parsed || 0;
              const index = context.dataIndex;
              
              // Calculer l'index réel en tenant compte du séparateur
              let realIndex = index;
              if (needsSeparator && index > separator1Index) {
                realIndex = index - 1;
              }
              
              const isDebit = realIndex < debitSegments.length;
              const total = isDebit ? totalDebit : totalCredit;
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
              
              const allSegments = [...debitSegments, ...creditSegments];
              const segment = allSegments[realIndex];
              if (!segment) return [];
              
              const isGroup = segment.isGroup && segment.subscriptions.length >= 2;
              const groupHint = isGroup 
                ? ` - ${t('projectManagement.charts.clickToViewDetails', 'Cliquez pour voir le détail par ligne')}`
                : '';
              return [
                `${label}: ${formatCurrency(value)}`,
                `${percentage}% ${isDebit ? t('projectManagement.charts.debit', 'Débit') : t('projectManagement.charts.credit', 'Crédit')}${groupHint}`,
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
          
          if (segment && segment.isGroup && segment.subscriptions.length >= 2) {
            setHoveredIndex(index);
          } else {
            setHoveredIndex(null);
          }
        } else {
          setHoveredIndex(null);
        }
      },
    };
  }, [isDarkMode, t, segmentsData, getSegmentFromChartIndex]);

  const handleChartClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!chartRef.current) {
      console.log('[CategoryBreakdown] Chart ref not available');
      return;
    }
    
    const elements = getElementAtEvent(chartRef.current, event);
    console.log('[CategoryBreakdown] Click detected, elements:', elements);
    
    if (elements.length === 0) {
      console.log('[CategoryBreakdown] No elements found');
      return;
    }

    const element = elements[0];
    const index = element.index;
    console.log('[CategoryBreakdown] Element index:', index);
    
    // Obtenir le segment réel (en ignorant les séparateurs)
    const segment = getSegmentFromChartIndex(index);
    
    if (!segment) {
      console.log('[CategoryBreakdown] Clicked on separator, ignoring');
      return;
    }
    
    console.log('[CategoryBreakdown] Segment:', segment.lineName, 'Subscriptions count:', segment.subscriptions.length);
    
    // Ouvrir la modale seulement si c'est un groupe (≥ 2 lignes)
    if (segment.isGroup && segment.subscriptions.length >= 2) {
      console.log('[CategoryBreakdown] Opening modal for group');
      const typeLabel = segment.type === 'debit' 
        ? t('projectManagement.charts.drillDownDebit', 'Débits')
        : t('projectManagement.charts.drillDownCredit', 'Crédits');
      const title = t('projectManagement.charts.drillDownTitle', 'Détail par ligne – {{line}} ({{type}})', {
        line: segment.lineName,
        type: typeLabel,
      });
      
      console.log('[CategoryBreakdown] Modal data:', { title, subscriptionsCount: segment.subscriptions.length });
      
      if (onOpenDrillDown) {
        onOpenDrillDown({
          title,
          subscriptions: segment.subscriptions,
        });
      }
    } else {
      console.log('[CategoryBreakdown] Segment is not a group (only', segment.subscriptions.length, 'line(s))');
    }
  }, [getSegmentFromChartIndex, t, onOpenDrillDown]);

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

export default CategoryBreakdownChart;
