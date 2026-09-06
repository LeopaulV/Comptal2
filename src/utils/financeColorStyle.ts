/** Heat-map cell styling (ported from Comptal2 FinanceGlobal). */
export function getColorStyle(value: number): { backgroundColor: string; color: string } {
  const isDarkMode = document.documentElement.classList.contains('dark');

  if (value === 0) {
    return isDarkMode
      ? { backgroundColor: '#334155', color: '#e2e8f0' }
      : { backgroundColor: '#ffffff', color: '#1e293b' };
  }

  const maxIntensity = 0.25;
  const minIntensity = 0.04;
  const normalizedValue = Math.min(Math.abs(value) / 10000, 1);
  const intensity = minIntensity + normalizedValue * (maxIntensity - minIntensity);

  const backgroundColor =
    value > 0
      ? `rgba(16, 185, 129, ${intensity})`
      : `rgba(239, 68, 68, ${intensity})`;

  let color: string;
  if (isDarkMode) {
    color = intensity > 0.12 ? '#ffffff' : '#cbd5e1';
  } else {
    color = intensity > 0.15 ? '#ffffff' : '#1e293b';
  }

  return { backgroundColor, color };
}
