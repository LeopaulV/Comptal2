import React, { useState } from 'react';
import { Settings, Palette, Folder, Database, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Common';
import AccountManager from '../../components/Parametre/AccountManager';
import CategoryManager from '../../components/Parametre/CategoryManager';
import { ConfigService } from '../../services/ConfigService';
import { EditionService } from '../../services/EditionService';
import { useLanguage } from '../../hooks/useLanguage';

const APP_VERSION = '1.0.0';

type ParametreTab = 'general' | 'accounts' | 'categories' | 'data' | 'about';

const Parametre: React.FC = () => {
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState<ParametreTab>('general');
  const [isRebuildingStats, setIsRebuildingStats] = useState(false);

  const tabs = [
    { id: 'general' as const, label: t('settings.general'), icon: Settings },
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
          </div>
        </Card>
      )}

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
                  value="./data"
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300
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
                <button className="px-4 py-2 bg-primary-600 text-white rounded-lg
                                 hover:bg-primary-700 transition-colors">
                  {t('settings.exportConfig')}
                </button>
                <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300
                                 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                  {t('settings.importConfig')}
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
              <button className="px-4 py-2 bg-red-600 text-white rounded-lg
                               hover:bg-red-700 transition-colors">
                {t('settings.resetApp')}
              </button>
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

