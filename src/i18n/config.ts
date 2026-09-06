import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './locales/fr.json';
import en from './locales/en.json';
import de from './locales/de.json';

export const SUPPORTED_LNGS = ['fr', 'en', 'de'] as const;

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    de: { translation: de },
  },
  lng: 'fr',
  fallbackLng: 'fr',
  supportedLngs: [...SUPPORTED_LNGS],
  interpolation: { escapeValue: false },
});

export default i18n;
