import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import './styles/finance-global-custom.css';
import './styles/edition-custom.css';
import './styles/dashboard-custom.css';
import './styles/upload-custom.css';
import i18n from './i18n/config';
import { Logger } from './services/logger';
import { SettingsService } from './services/SettingsService';
import { ProfileService } from './services/ProfileService';
import { WindowService } from './services/WindowService';
import { isTauriAvailable } from './services/tauri';
import { applyThemeToDocument } from './hooks/useTheme';

async function bootstrap(): Promise<void> {
  const startedAt = performance.now();
  await Logger.init();

  try {
    const settings = await SettingsService.load();
    applyThemeToDocument(settings.theme);
    await i18n.changeLanguage(settings.language);
    document.documentElement.lang = settings.language;
    if (isTauriAvailable()) {
      WindowService.apply(settings.window).catch((err) =>
        Logger.error('bootstrap.window', err)
      );
    }
    await ProfileService.ensureInitialized();
  } catch (error) {
    Logger.error('bootstrap', error, "Échec d'initialisation");
  }

  const rootElement = document.getElementById('root');
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(<App />);
  }
  Logger.perf('bootstrap', 'Démarrage complet', performance.now() - startedAt);
}

void bootstrap();
