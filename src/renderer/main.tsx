import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n/config';
import { ProfileService } from './services/ProfileService';

async function bootstrap(): Promise<void> {
  try {
    await ProfileService.ensureInitialized();
  } catch (error: any) {
    console.error('[bootstrap] Initialisation des profils:', error);
  }

  const rootElement = document.getElementById('root');
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(<App />);
  }
}

bootstrap();
