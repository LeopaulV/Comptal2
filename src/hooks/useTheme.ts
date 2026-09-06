import { useCallback, useEffect, useState } from 'react';
import { SettingsService } from '../services/SettingsService';
import { Logger } from '../services/logger';
import { applyChartJsDefaults } from '../utils/chartPastel';

export type Theme = 'light' | 'dark';

/** Applique le thème au document (classe .dark sur <html>). */
export function applyThemeToDocument(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  applyChartJsDefaults(theme === 'dark');
}

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );

  useEffect(() => {
    return SettingsService.subscribe((settings) => setTheme(settings.theme));
  }, []);

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    applyThemeToDocument(next);
    SettingsService.save({ theme: next }).catch((err) =>
      Logger.error('useTheme.toggleTheme', err)
    );
  }, [theme]);

  return { theme, toggleTheme };
}
