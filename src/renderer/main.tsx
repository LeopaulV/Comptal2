import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n/config';

// StrictMode désactivé en développement pour éviter la double initialisation de noUiSlider
try {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(<App />);
  }
} catch (error: any) {
  console.error('Error rendering app:', error);
}

