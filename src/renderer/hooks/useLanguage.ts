import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfigService } from '../services/ConfigService';
import { AppSettings } from '../types/Settings';

export const useLanguage = () => {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState<'fr' | 'en'>('fr');
  const [isLoading, setIsLoading] = useState(true);

  // Charger la langue depuis les settings au montage
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const settings = await ConfigService.loadSettings();
        const lang = settings.language || 'fr';
        setCurrentLanguage(lang);
        await i18n.changeLanguage(lang);
      } catch (error) {
        console.error('Erreur lors du chargement de la langue:', error);
        // Utiliser la langue par défaut en cas d'erreur
        await i18n.changeLanguage('fr');
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguage();
  }, [i18n]);

  // Fonction pour changer la langue
  const changeLanguage = async (lang: 'fr' | 'en') => {
    try {
      // Changer la langue dans i18next
      await i18n.changeLanguage(lang);
      setCurrentLanguage(lang);

      // Sauvegarder dans les settings
      const settings = await ConfigService.loadSettings();
      const updatedSettings: AppSettings = {
        ...settings,
        language: lang,
      };
      await ConfigService.saveSettings(updatedSettings);
    } catch (error) {
      console.error('Erreur lors du changement de langue:', error);
      throw error;
    }
  };

  return {
    currentLanguage,
    changeLanguage,
    isLoading,
  };
};

