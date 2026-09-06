import {
  chartAxisColor,
  chartGridColor,
  chartMutedFill,
  chartTooltipTheme,
  readCssVar,
} from './chartPastel';

export interface DashboardChartTheme {
  primary: string;
  primaryLight: string;
  secondary: string;
  success: string;
  warning: string;
  pastelAccent: string;
  danger: string;
  muted: string;
  text: string;
  grid: string;
  tooltipBackground: string;
  tooltipTitle: string;
  tooltipBody: string;
  tooltipBorder: string;
}

export function dashboardChartTheme(isDarkMode: boolean): DashboardChartTheme {
  const tooltip = chartTooltipTheme(isDarkMode);
  return {
    primary: isDarkMode ? '#3b82f6' : '#1e3a8a',
    primaryLight: isDarkMode ? '#60a5fa' : '#3b82f6',
    secondary: isDarkMode ? '#2dd4bf' : '#0f766e',
    success: '#10b981',
    warning: '#f59e0b',
    pastelAccent: isDarkMode ? '#f8d48b' : '#e9b96e',
    danger: '#ef4444',
    muted: chartMutedFill(isDarkMode),
    text: chartAxisColor(isDarkMode),
    grid: chartGridColor(isDarkMode),
    tooltipBackground: tooltip.backgroundColor,
    tooltipTitle: tooltip.titleColor,
    tooltipBody: tooltip.bodyColor,
    tooltipBorder: tooltip.borderColor,
  };
}

export function dashboardTooltipOptions(colors: DashboardChartTheme) {
  return {
    backgroundColor: colors.tooltipBackground,
    titleColor: colors.tooltipTitle,
    bodyColor: colors.tooltipBody,
    borderColor: colors.tooltipBorder,
    borderWidth: 1,
  };
}

export function agingColors(isDarkMode: boolean): string[] {
  return isDarkMode
    ? ['#6bcf9a', '#a9d77c', '#f4cf68', '#f3a567', '#eb7f86']
    : ['#86d4a8', '#b7dd8c', '#f6d77a', '#f6b276', '#ef8f8f'];
}

export function chartPointBorder(isDarkMode: boolean): string {
  return readCssVar('--chart-card', isDarkMode ? '#334155' : '#ffffff');
}
