import React, { useState, useEffect } from 'react';
import { Settings, Palette, Folder, Database, Info, Trash2, FileSpreadsheet, UserCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Common';
import AccountManager from '../../components/Parametre/AccountManager';
import CategoryManager from '../../components/Parametre/CategoryManager';
import ProfileManager from '../../components/Parametre/ProfileManager';
import { ConfigService } from '../../services/ConfigService';
import { EditionService } from '../../services/EditionService';
import { DataService } from '../../services/DataService';
import { FileService } from '../../services/FileService';
import { useLanguage } from '../../hooks/useLanguage';
import { OnboardingService } from '../../services/OnboardingService';
import { MenuVisibility, DEFAULT_MENU_VISIBILITY } from '../../types/Settings';

const APP_VERSION = '1.1.0';

type ParametreTab = 'general' | 'profiles' | 'accounts' | 'categories' | 'data' | 'about';

const Parametre: React.FC = () => {
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState<ParametreTab>('general');

  const [isRebuildingStats, setIsRebuildingStats] = useState(false);
  const [dataFolderPath, setDataFolderPath] = useState<string>('./data');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [menuVisibility, setMenuVisibility] = useState<MenuVisibility>(DEFAULT_MENU_VISIBILITY);
  const [dataFiles, setDataFiles] = useState<string[]>([]);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  // Charger le chemin de données et la visibilité du menu au montage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await ConfigService.loadSettings();
        if (settings.dataDirectory) {
          setDataFolderPath(settings.dataDirectory);
        }
        if (settings.menuVisibility) {
          setMenuVisibility(settings.menuVisibility);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des paramètres:', error);
      }
    };
    loadSettings();
  }, []);

  // Ouvrir automatiquement l'onglet "accounts" si aucun compte n'existe (pour le didacticiel)
  useEffect(() => {
    const checkAndOpenAccounts = async () => {
      const hasAccounts = await OnboardingService.hasUserAccounts();
      if (!hasAccounts) {
        setActiveTab('accounts');
      }
    };
    checkAndOpenAccounts();
  }, []); // Ne s'exécute qu'une fois au montage

  // Charger la liste des fichiers du dossier data quand l'onglet Données est actif
  useEffect(() => {
    if (activeTab !== 'data') return;
    const loadDataFiles = async () => {
      try {
        const files = await FileService.readDirectory(dataFolderPath);
        setDataFiles(files.sort());
      } catch (error: any) {
        console.error('Erreur chargement fichiers data:', error);
        setDataFiles([]);
      }
    };
    loadDataFiles();
  }, [activeTab, dataFolderPath]);

  // Handler pour mettre à jour la visibilité du menu
  const handleMenuVisibilityChange = async (key: keyof MenuVisibility, value: boolean) => {
    try {
      const newVisibility = { ...menuVisibility, [key]: value };
      setMenuVisibility(newVisibility);
      
      const settings = await ConfigService.loadSettings();
      settings.menuVisibility = newVisibility;
      await ConfigService.saveSettings(settings);
      
      // Recharger la page pour appliquer les changements dans le menu
      window.location.reload();
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde de la visibilité du menu:', error);
      alert(t('settings.menuVisibilityError', { error: error.message }));
    }
  };

  // Handler pour sélectionner un dossier de données
  const handleBrowseDataFolder = async () => {
    try {
      const result = await window.electronAPI.selectFolder();
      if (result.success && result.path) {
        // Mettre à jour les settings avec le nouveau chemin
        const settings = await ConfigService.loadSettings();
        settings.dataDirectory = result.path;
        await ConfigService.saveSettings(settings);
        setDataFolderPath(result.path);
        
        // Vider le cache et recharger les données
        ConfigService.clearCache();
        await DataService.reload();
        
        alert(t('settings.dataFolderUpdated', { path: result.path }));
        
        // Recharger la page pour que tous les composants se mettent à jour
        window.location.reload();
      } else if (!result.canceled) {
        alert(t('settings.dataFolderError', { error: result.error || 'Erreur inconnue' }));
      }
    } catch (error: any) {
      alert(t('settings.dataFolderError', { error: error.message }));
    }
  };

  // Handler pour exporter la configuration
  const handleExportConfig = async () => {
    setIsExporting(true);
    try {
      // Charger toutes les configurations
      const accounts = await ConfigService.loadAccounts();
      const categories = await ConfigService.loadCategories();
      const settings = await ConfigService.loadSettings();
      const autoCategorisation = await ConfigService.loadAutoCategorisationStats();
      const colorPalettes = await ConfigService.loadColorPalettes();

      // Créer l'objet de configuration complet
      const config = {
        version: '1.1.0',
        exportDate: new Date().toISOString(),
        accounts,
        categories,
        settings,
        autoCategorisation,
        colorPalettes,
      };

      const configJson = JSON.stringify(config, null, 2);

      // Demander où sauvegarder le fichier
      const result = await window.electronAPI.saveFile({
        defaultPath: `comptal2-config-${new Date().toISOString().split('T')[0]}.json`,
        filters: [
          { name: 'Fichier JSON', extensions: ['json'] },
          { name: 'Tous les fichiers', extensions: ['*'] },
        ],
      });

      if (result.success && result.path) {
        await window.electronAPI.writeExternalFile(result.path, configJson);
        alert(t('settings.exportSuccess', { path: result.path }));
      } else if (!result.canceled) {
        alert(t('settings.exportError', { error: result.error || 'Erreur inconnue' }));
      }
    } catch (error: any) {
      alert(t('settings.exportError', { error: error.message }));
    } finally {
      setIsExporting(false);
    }
  };

  // Handler pour importer la configuration
  const handleImportConfig = async () => {
    if (!window.confirm(t('settings.importConfirm'))) {
      return;
    }

    setIsImporting(true);
    try {
      // Sélectionner le fichier à importer
      const result = await window.electronAPI.selectFile({
        filters: [
          { name: 'Fichier JSON', extensions: ['json'] },
          { name: 'Tous les fichiers', extensions: ['*'] },
        ],
      });

      if (result.success && result.path) {
        // Lire le fichier
        const fileResult = await window.electronAPI.readExternalFile(result.path);
        if (!fileResult.success || !fileResult.data) {
          throw new Error(fileResult.error || 'Impossible de lire le fichier');
        }

        // Parser le JSON
        const config = JSON.parse(fileResult.data);

        // Vérifier la structure du fichier
        if (!config.version) {
          throw new Error('Format de fichier invalide : version manquante');
        }

        // Restaurer les configurations
        if (config.accounts) {
          await ConfigService.saveAccounts(config.accounts);
        }
        if (config.categories) {
          await ConfigService.saveCategories(config.categories);
        }
        if (config.settings) {
          await ConfigService.saveSettings(config.settings);
          if (config.settings.dataDirectory) {
            setDataFolderPath(config.settings.dataDirectory);
          }
        }
        if (config.autoCategorisation) {
          await ConfigService.saveAutoCategorisationStats(config.autoCategorisation);
        }
        if (config.colorPalettes) {
          await ConfigService.saveColorPalettes(config.colorPalettes);
        }

        // Vider le cache pour forcer le rechargement
        ConfigService.clearCache();

        alert(t('settings.importSuccess'));
        // Recharger la page pour appliquer les changements
        window.location.reload();
      } else if (!result.canceled) {
        alert(t('settings.importError', { error: result.error || 'Erreur inconnue' }));
      }
    } catch (error: any) {
      alert(t('settings.importError', { error: error.message }));
    } finally {
      setIsImporting(false);
    }
  };

  // Handler pour réinitialiser l'application
  const handleResetApp = async () => {
    const confirmMessage = t('settings.resetAppConfirm');
    if (!window.confirm(confirmMessage)) {
      return;
    }

    const doubleConfirmMessage = t('settings.resetAppDoubleConfirm');
    const userInput = window.prompt(doubleConfirmMessage);
    if (userInput !== 'CONFIRMER' && userInput !== 'CONFIRM') {
      return;
    }

    setIsResetting(true);
    try {
      // Réinitialiser toutes les configurations
      await ConfigService.saveAccounts({});
      await ConfigService.saveCategories({});
      await ConfigService.saveAutoCategorisationStats({});
      await ConfigService.saveColorPalettes([]);
      
      // Réinitialiser les settings aux valeurs par défaut
      const defaultSettings = await ConfigService.loadSettings();
      defaultSettings.onboardingCompleted = false;
      await ConfigService.saveSettings(defaultSettings);

      // Vider le cache
      ConfigService.clearCache();

      alert(t('settings.resetAppSuccess'));
      // Recharger la page
      window.location.reload();
    } catch (error: any) {
      alert(t('settings.resetAppError', { error: error.message }));
    } finally {
      setIsResetting(false);
    }
  };

  const tabs = [
    { id: 'general' as const, label: t('settings.general'), icon: Settings },
    { id: 'profiles' as const, label: t('settings.profiles'), icon: UserCircle },
    { id: 'accounts' as const, label: t('settings.accounts'), icon: Database },
    { id: 'categories' as const, label: t('settings.categories'), icon: Palette },
    { id: 'data' as const, label: t('settings.data'), icon: Folder },
    { id: 'about' as const, label: t('settings.about'), icon: Info },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {t('settings.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t('settings.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-tour-tab={tab.id}
              className={`
                flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2
                ${activeTab === tab.id
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }
              `}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === 'general' && (
        <Card title={t('settings.general')}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settings.language')}
              </label>
              <select 
                value={currentLanguage}
                onChange={(e) => changeLanguage(e.target.value as 'fr' | 'en')}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="auto-save"
                defaultChecked
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <label htmlFor="auto-save" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('settings.autoSave')}
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="show-balance"
                defaultChecked
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <label htmlFor="show-balance" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('settings.showBalance')}
              </label>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                {t('settings.menuVisibility')}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('settings.menuVisibilityDescription')}
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="menu-dashboard"
                    checked={menuVisibility.dashboard}
                    onChange={(e) => handleMenuVisibilityChange('dashboard', e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="menu-dashboard" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('navigation.dashboard')}
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="menu-upload"
                    checked={menuVisibility.upload}
                    onChange={(e) => handleMenuVisibilityChange('upload', e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="menu-upload" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('navigation.import')}
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="menu-edition"
                    checked={menuVisibility.edition}
                    onChange={(e) => handleMenuVisibilityChange('edition', e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="menu-edition" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('navigation.edition')}
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="menu-finance-global"
                    checked={menuVisibility.financeGlobal}
                    onChange={(e) => handleMenuVisibilityChange('financeGlobal', e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="menu-finance-global" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('navigation.financeGlobal')}
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="menu-project-management"
                    checked={menuVisibility.projectManagement}
                    onChange={(e) => handleMenuVisibilityChange('projectManagement', e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="menu-project-management" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('navigation.projectManagement')}
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="menu-invoicing"
                    checked={menuVisibility.invoicing}
                    onChange={(e) => handleMenuVisibilityChange('invoicing', e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="menu-invoicing" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('navigation.invoicing')}
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="menu-association"
                    checked={menuVisibility.association}
                    onChange={(e) => handleMenuVisibilityChange('association', e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="menu-association" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('navigation.association')}
                  </label>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'profiles' && <ProfileManager />}

      {activeTab === 'accounts' && (
        <Card title={t('settings.accountManagement')} subtitle={t('settings.accountManagementSubtitle')}>
          <AccountManager />
        </Card>
      )}

      {activeTab === 'categories' && (
        <Card title={t('settings.categoryManagement')} subtitle={t('settings.categoryManagementSubtitle')}>
          <CategoryManager />
        </Card>
      )}

      {activeTab === 'data' && (
        <Card title={t('settings.data')}>
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                {t('settings.dataFolder')}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t('settings.dataFolderDescription')}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={dataFolderPath}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <button 
                  onClick={handleBrowseDataFolder}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300
                                 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                  {t('settings.browse')}
                </button>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                {t('settings.backupRestore')}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t('settings.backupRestoreDescription')}
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={handleExportConfig}
                  disabled={isExporting}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg
                                 hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {isExporting ? t('settings.exporting') : t('settings.exportConfig')}
                </button>
                <button 
                  onClick={handleImportConfig}
                  disabled={isImporting}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300
                                 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {isImporting ? t('settings.importing') : t('settings.importConfig')}
                </button>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                {t('settings.autoCategorization')}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t('settings.autoCategorizationDescription')}
              </p>
              <button
                onClick={async () => {
                  if (window.confirm(t('settings.rebuildConfirm'))) {
                    setIsRebuildingStats(true);
                    try {
                      const result = await EditionService.rebuildAutoCategorisationStats();
                      ConfigService.clearCache();
                      alert(t('settings.rebuildSuccess', { processed: result.processed, stats: result.statsCount }));
                    } catch (error: any) {
                      alert(t('settings.rebuildError', { error: error.message }));
                    } finally {
                      setIsRebuildingStats(false);
                    }
                  }
                }}
                disabled={isRebuildingStats}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg
                           hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRebuildingStats ? t('settings.rebuilding') : t('settings.rebuildStats')}
              </button>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-semibold text-orange-600 dark:text-orange-400 mb-2">
                {t('settings.resetStats')}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t('settings.resetStatsDescription')}
              </p>
              <button
                onClick={async () => {
                  if (window.confirm(t('settings.resetConfirm'))) {
                    try {
                      await ConfigService.saveAutoCategorisationStats({});
                      ConfigService.clearCache();
                      alert(t('settings.resetSuccess'));
                    } catch (error: any) {
                      alert(t('settings.resetError', { error: error.message }));
                    }
                  }
                }}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg
                           hover:bg-orange-700 transition-colors"
              >
                {t('settings.resetStatsButton')}
              </button>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">
                {t('settings.dangerZone')}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t('settings.dangerZoneDescription')}
              </p>
              <button 
                onClick={handleResetApp}
                disabled={isResetting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg
                               hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {isResetting ? t('settings.resetting') : t('settings.resetApp')}
              </button>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                {t('settings.dataFilesList')}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t('settings.dataFilesListDescription')}
              </p>
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 max-h-64 overflow-y-auto">
                {dataFiles.length === 0 ? (
                  <p className="p-4 text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.dataFilesEmpty')}
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-200 dark:divide-gray-600">
                    {dataFiles.map((fileName) => {
                      const isCsv = fileName.toLowerCase().endsWith('.csv');
                      const fullPath = `${dataFolderPath.replace(/\/$/, '')}/${fileName}`;
                      return (
                        <li
                          key={fileName}
                          className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                        >
                          <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 truncate min-w-0">
                            {isCsv ? (
                              <FileSpreadsheet className="flex-shrink-0 w-4 h-4 text-green-600 dark:text-green-400" />
                            ) : null}
                            {fileName}
                          </span>
                          {isCsv && (
                            <button
                              onClick={async () => {
                                if (!window.confirm(t('settings.dataFileDeleteConfirm', { file: fileName }))) return;
                                setDeletingFile(fileName);
                                try {
                                  await FileService.deleteFile(fullPath);
                                  setDataFiles((prev) => prev.filter((f) => f !== fileName));
                                  ConfigService.clearCache();
                                  await DataService.reload();
                                } catch (error: any) {
                                  alert(t('settings.dataFileDeleteError', { error: error.message }));
                                } finally {
                                  setDeletingFile(null);
                                }
                              }}
                              disabled={deletingFile === fileName}
                              className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
                              title={t('settings.dataFileDelete')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'about' && (
        <Card title={t('settings.aboutTitle')}>
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-3xl font-bold text-white">C2</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Comptal2
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-1 font-medium">
                {t('settings.version', { version: APP_VERSION })}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 max-w-md mx-auto">
                {t('settings.description')}
              </p>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
                {t('settings.technologies')}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  'Electron',
                  'React',
                  'TypeScript',
                  'Vite',
                  'Tailwind CSS',
                  'Recharts',
                  'Chart.js',
                  'i18next',
                  'date-fns'
                ].map((tech) => (
                  <div
                    key={tech}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-center
                             text-sm font-medium text-gray-700 dark:text-gray-300
                             hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {tech}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                {t('settings.developer')}
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                {t('settings.developerName')}
              </p>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                {t('settings.license')}
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                {t('settings.licenseText')}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Parametre;

