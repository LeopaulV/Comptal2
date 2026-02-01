import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Chart as ChartJS, ChartOptions, registerables } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { formatCurrency } from '../../utils/format';
import { Subscription, ProjectionConfig } from '../../types/ProjectManagement';
import { ProjectionService } from '../../services/ProjectionService';
import { eachDayOfInterval, startOfDay } from 'date-fns';
import { CategoriesConfig } from '../../types/Category';
import { lightenColor, darkenColor } from '../../utils/colorPalettes';

ChartJS.register(...registerables);

interface CategoryDistributionChartProps {
  subscriptions: Subscription[];
  projectionConfig: ProjectionConfig;
  categories: CategoriesConfig;
}

interface LineData {
  id: string;
  name: string;
  categoryCode: string;
  categoryName: string;
  amount: number;
  color: string;
}

interface CategoryData {
  categoryCode: string;
  categoryName: string;
  lines: LineData[];
  totalAmount: number;
}

const CategoryDistributionChart: React.FC<CategoryDistributionChartProps> = ({ 
  subscriptions, 
  projectionConfig,
  categories 
}) => {
  const { t } = useTranslation();
  const chartRef = useRef<ChartJS<'bar'>>(null);
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

  // Calculer les données par catégorie avec différenciation des couleurs
  const categoryData = useMemo((): CategoryData[] => {
    const categoryMap = new Map<string, CategoryData>();
    const startDate = startOfDay(projectionConfig.startDate);
    const endDate = startOfDay(projectionConfig.endDate);
    const dates = eachDayOfInterval({ start: startDate, end: endDate });
    const flatSubscriptions = ProjectionService.getAllFlatSubscriptions(subscriptions);

    // Calculer le montant total par ligne sur la période
    const lineAmounts = new Map<string, number>();
    for (const subscription of flatSubscriptions) {
      let totalAmount = 0;
      for (const date of dates) {
        const amount = ProjectionService.applySubscriptionToDate(subscription, date);
        if (amount !== 0) {
          totalAmount += Math.abs(amount);
        }
      }
      if (totalAmount > 0) {
        lineAmounts.set(subscription.id, totalAmount);
      }
    }

    // Grouper par catégorie et calculer les couleurs avec différenciation
    for (const subscription of flatSubscriptions) {
      const totalAmount = lineAmounts.get(subscription.id);
      if (!totalAmount || totalAmount === 0) {
        continue;
      }

      const categoryCode = subscription.categoryCode || '__uncategorized__';
      const categoryName = categoryCode === '__uncategorized__' 
        ? t('projectManagement.charts.uncategorized', 'Non catégorisé')
        : (categories[categoryCode]?.name || categoryCode);

      if (!categoryMap.has(categoryCode)) {
        categoryMap.set(categoryCode, {
          categoryCode,
          categoryName,
          lines: [],
          totalAmount: 0,
        });
      }

      const categoryData = categoryMap.get(categoryCode)!;
      
      // Obtenir la couleur de base
      const baseColor = subscription.color || categories[categoryCode]?.color || '#0ea5e9';
      
      // Appliquer la logique de différenciation des couleurs
      // Mode sombre : éclaircir, Mode clair : assombrir
      const usedColors = new Map<string, number>();
      for (const existingLine of categoryData.lines) {
        usedColors.set(existingLine.color, 1);
      }

      let lineColor = baseColor;
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

      categoryData.lines.push({
        id: subscription.id,
        name: subscription.name,
        categoryCode,
        categoryName,
        amount: totalAmount,
        color: lineColor,
      });

      categoryData.totalAmount += totalAmount;
    }

    // Trier les catégories par nom et les lignes par montant décroissant
    return Array.from(categoryMap.values())
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
      .map(cat => ({
        ...cat,
        lines: cat.lines.sort((a, b) => b.amount - a.amount),
      }));
  }, [subscriptions, projectionConfig, categories, t, isDarkMode]);

  const chartData = useMemo(() => {
    if (categoryData.length === 0) {
      return {
        labels: [],
        datasets: [],
      };
    }

    const labels = categoryData.map(cat => cat.categoryName);
    
    // Créer un dataset par ligne (abonnement)
    // Chaque dataset a un tableau de longueur categories.length avec le montant uniquement à l'index de la catégorie
    const datasets = [];
    const processedLineIds = new Set<string>();
    
    for (const category of categoryData) {
      for (const line of category.lines) {
        // Éviter les doublons (une ligne n'appartient qu'à une seule catégorie)
        if (processedLineIds.has(line.id)) {
          continue;
        }
        processedLineIds.add(line.id);

        const data = new Array(categoryData.length).fill(0);
        const categoryIndex = categoryData.findIndex(cat => cat.categoryCode === category.categoryCode);
        if (categoryIndex !== -1) {
          data[categoryIndex] = line.amount;
        }

        datasets.push({
          label: line.name,
          data,
          backgroundColor: line.color,
          borderColor: line.color,
          borderWidth: 1,
          stack: 'stack',
        });
      }
    }

    return {
      labels,
      datasets,
    };
  }, [categoryData]);

  const options: ChartOptions<'bar'> = useMemo(() => {
    // Calculer les totaux par catégorie pour les tooltips
    const categoryTotals = categoryData.map(cat => cat.totalAmount);

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
          stacked: true,
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
          stacked: true,
          title: {
            display: true,
            text: t('projectManagement.charts.amount', 'Montant'),
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
          position: 'right' as const,
          align: 'start' as const,
          labels: {
            boxWidth: 12,
            padding: 6,
            font: {
              size: 9,
            },
            color: isDarkMode ? '#cbd5e1' : '#1e293b',
            usePointStyle: false,
            maxWidth: 180,
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
              const value = context.parsed.y || 0;
              
              if (value === 0) {
                return undefined; // Ne pas afficher les tooltips pour les valeurs 0
              }

              // Trouver la catégorie correspondante pour calculer le pourcentage
              const categoryIndex = context.dataIndex;
              const categoryTotal = categoryTotals[categoryIndex] || 0;
              const percentage = categoryTotal > 0 ? ((value / categoryTotal) * 100).toFixed(1) : '0.0';
              
              return [
                `${label}: ${formatCurrency(value)}`,
                `${percentage}%`,
              ];
            },
          },
        },
      },
    };
  }, [isDarkMode, t, categoryData]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Bar
        ref={chartRef}
        data={chartData}
        options={options}
      />
    </div>
  );
};

export default CategoryDistributionChart;
