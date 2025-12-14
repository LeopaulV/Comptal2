// Types pour les graphiques et visualisations

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  date?: Date;
}

export interface LineChartData {
  date: string;
  [key: string]: string | number; // Permet plusieurs séries de données
}

export interface PieChartData {
  name: string;
  value: number;
  color: string;
  percentage: number;
}

export interface BarChartData {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface WealthChartData {
  date: string;
  balance: number;
  accounts: {
    [accountCode: string]: number;
  };
}

export interface CategoryChartData {
  category: string;
  amount: number;
  color: string;
  count: number;
}

export type ChartType = 'line' | 'bar' | 'pie' | 'area';

export interface ChartConfig {
  type: ChartType;
  title: string;
  showLegend: boolean;
  showGrid: boolean;
  animate: boolean;
}

