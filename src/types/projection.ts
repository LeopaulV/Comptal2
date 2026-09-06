import { ForecastWidgetLayout } from './forecast';

export type Periodicity = 'unique' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type FlowType = 'debit' | 'credit';

export interface Project {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  initialBalance: number;
  widgetLayout: ForecastWidgetLayout;
}

export interface ProjectSubscription {
  id: number;
  projectId: number;
  name: string;
  type: FlowType;
  amount: number;
  periodicity: Periodicity;
  startDate: string;
  endDate: string | null;
  categoryCode: string | null;
  color: string;
  parentId: number | null;
  isGroup: boolean;
  sortOrder: number;
  children?: ProjectSubscription[];
}

export type ForecastSubscription = ProjectSubscription;

export type ChartGranularity = 'day' | 'week' | 'month' | 'quarter' | 'semester' | 'year';

export const PERIODICITY_VALUES: Periodicity[] = [
  'unique',
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
];

export const DEFAULT_SUBSCRIPTION_COLOR = '#94a3b8';
