import { Chart } from 'chart.js';

export const CHART_PASTEL_TOKENS = [
  '--chart-pastel-blue',
  '--chart-pastel-green',
  '--chart-pastel-red',
  '--chart-pastel-orange',
  '--chart-pastel-purple',
  '--chart-pastel-yellow',
  '--chart-pastel-pink',
  '--chart-pastel-teal',
] as const;

export const CHART_PASTEL_FALLBACKS = [
  '#bfdbfe',
  '#bbf7d0',
  '#fecaca',
  '#fed7aa',
  '#e9d5ff',
  '#fef08a',
  '#fbcfe8',
  '#99f6e4',
] as const;

export type ChartPastelName =
  | 'blue'
  | 'green'
  | 'red'
  | 'orange'
  | 'purple'
  | 'yellow'
  | 'pink'
  | 'teal';

const PASTEL_INDEX: Record<ChartPastelName, number> = {
  blue: 0,
  green: 1,
  red: 2,
  orange: 3,
  purple: 4,
  yellow: 5,
  pink: 6,
  teal: 7,
};

export function readCssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function chartPastelPalette(): string[] {
  return CHART_PASTEL_TOKENS.map((token, index) =>
    readCssVar(token, CHART_PASTEL_FALLBACKS[index]!)
  );
}

export function chartPastel(index: number): string {
  const palette = chartPastelPalette();
  return palette[((index % palette.length) + palette.length) % palette.length]!;
}

export function chartPastelNamed(name: ChartPastelName): string {
  return chartPastel(PASTEL_INDEX[name]);
}

export function chartAxisColor(isDark: boolean): string {
  return readCssVar('--chart-axis', isDark ? '#e2e8f0' : '#1e293b');
}

export function chartGridColor(isDark: boolean): string {
  return readCssVar('--chart-grid', isDark ? 'rgba(226, 232, 240, 0.22)' : 'rgba(148, 163, 184, 0.28)');
}

export function chartZeroGridColor(isDark: boolean): string {
  return readCssVar('--chart-grid-zero', isDark ? 'rgba(248, 250, 252, 0.38)' : 'rgba(15, 23, 42, 0.22)');
}

export function chartSurfaceColor(isDark: boolean): string {
  return readCssVar('--chart-card', isDark ? '#334155' : '#ffffff');
}

export function chartMutedFill(isDark: boolean): string {
  return readCssVar('--chart-muted-fill', isDark ? '#cbd5e1' : '#e2e8f0');
}

export function chartTooltipTheme(isDark: boolean) {
  return {
    backgroundColor: readCssVar(
      '--chart-tooltip-bg',
      isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.96)'
    ),
    titleColor: readCssVar('--chart-tooltip-title', isDark ? '#f8fafc' : '#1e293b'),
    bodyColor: readCssVar('--chart-tooltip-body', isDark ? '#e2e8f0' : '#334155'),
    borderColor: readCssVar(
      '--chart-tooltip-border',
      isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(15, 23, 42, 0.12)'
    ),
    borderWidth: 1,
  };
}

export function chartGridCallback(isDark: boolean) {
  const zero = chartZeroGridColor(isDark);
  const grid = chartGridColor(isDark);
  return (context: { tick?: { value?: number } }) =>
    context.tick?.value === 0 ? zero : grid;
}

/** Applique les couleurs d’axes / grilles / infobulles aux défauts Chart.js. */
export function applyChartJsDefaults(isDark: boolean): void {
  const axis = chartAxisColor(isDark);
  const grid = chartGridColor(isDark);
  const tooltip = chartTooltipTheme(isDark);

  Chart.defaults.color = axis;
  Chart.defaults.borderColor = grid;

  if (Chart.defaults.plugins.legend?.labels) {
    Chart.defaults.plugins.legend.labels.color = axis;
  }
  if (Chart.defaults.plugins.tooltip) {
    Chart.defaults.plugins.tooltip.backgroundColor = tooltip.backgroundColor;
    Chart.defaults.plugins.tooltip.titleColor = tooltip.titleColor;
    Chart.defaults.plugins.tooltip.bodyColor = tooltip.bodyColor;
    Chart.defaults.plugins.tooltip.borderColor = tooltip.borderColor;
    Chart.defaults.plugins.tooltip.borderWidth = tooltip.borderWidth;
  }

  if (Chart.defaults.scale?.ticks) {
    Chart.defaults.scale.ticks.color = axis;
  }
  if (Chart.defaults.scale?.grid) {
    Chart.defaults.scale.grid.color = grid;
  }
}
