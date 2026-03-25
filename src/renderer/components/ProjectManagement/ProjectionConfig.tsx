import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectionConfig as ProjectionConfigType } from '../../types/ProjectManagement';
import { formatCurrency } from '../../utils/format';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import AccountSelectionDialog from './AccountSelectionDialog';
import AccountProjectionManager from './AccountProjectionManager';

interface ProjectionConfigProps {
  config: ProjectionConfigType;
  onConfigChange: (config: ProjectionConfigType) => void;
  titleKey?: string;
}

const ProjectionConfig: React.FC<ProjectionConfigProps> = ({
  config,
  onConfigChange,
  titleKey,
}) => {
  const { t } = useTranslation();
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [tempConfig, setTempConfig] = useState<ProjectionConfigType>(config);
  const [isAccountSelectionOpen, setIsAccountSelectionOpen] = useState(false);

  const handleConfigSave = useCallback(() => {
    onConfigChange(tempConfig);
    setIsEditingConfig(false);
  }, [tempConfig, onConfigChange]);

  const handleConfigCancel = useCallback(() => {
    setTempConfig(config);
    setIsEditingConfig(false);
  }, [config]);

  const handleAccountSelection = useCallback((totalBalance: number) => {
    setTempConfig({ ...tempConfig, initialBalance: totalBalance });
  }, [tempConfig]);

  const handleAccountConfigsChange = useCallback((accountConfigs: ProjectionConfigType['accountConfigs']) => {
    setTempConfig(prev => ({ ...prev, accountConfigs }));
  }, []);

  // Synchroniser tempConfig avec config quand il change
  useEffect(() => {
    setTempConfig(config);
  }, [config]);

  return (
    <div className="projection-config-compact mb-4">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {titleKey ? t(titleKey) : t('projectManagement.dashboard.config', 'Configuration de projection')}
          </h3>
          {!isEditingConfig ? (
            <button
              onClick={() => {
                setTempConfig(config);
                setIsEditingConfig(true);
              }}
              className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 px-3 py-1 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
            >
              {t('common.edit', 'Modifier')}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleConfigSave}
                className="text-sm text-green-600 hover:text-green-700 dark:text-green-400 px-3 py-1 rounded hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
              >
                {t('common.save', 'Enregistrer')}
              </button>
              <button
                onClick={handleConfigCancel}
                className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 px-3 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('common.cancel', 'Annuler')}
              </button>
            </div>
          )}
        </div>
        {isEditingConfig ? (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                {t('projectManagement.dashboard.startDate', 'Date de début')}
              </label>
              <input
                type="date"
                value={format(tempConfig.startDate, 'yyyy-MM-dd')}
                onChange={(e) => setTempConfig({ ...tempConfig, startDate: new Date(e.target.value) })}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                {t('projectManagement.dashboard.endDate', 'Date de fin')}
              </label>
              <input
                type="date"
                value={format(tempConfig.endDate, 'yyyy-MM-dd')}
                onChange={(e) => setTempConfig({ ...tempConfig, endDate: new Date(e.target.value) })}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                {t('projectManagement.dashboard.initialBalance', 'Solde initial')}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={tempConfig.initialBalance}
                  onChange={(e) => setTempConfig({ ...tempConfig, initialBalance: parseFloat(e.target.value) || 0 })}
                  className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setIsAccountSelectionOpen(true)}
                  className="px-3 py-1 text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 border border-primary-300 dark:border-primary-600 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors whitespace-nowrap"
                  title={t('projectManagement.accountSelectionDialog.selectFromAccounts', 'Sélectionner depuis les comptes')}
                >
                  {t('projectManagement.accountSelectionDialog.select', 'Sélectionner')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-6 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <span className="font-medium">{t('projectManagement.dashboard.period', 'Période')}:</span>{' '}
              {format(config.startDate, 'dd/MM/yyyy', { locale: fr })} - {format(config.endDate, 'dd/MM/yyyy', { locale: fr })}
            </div>
            <div>
              <span className="font-medium">{t('projectManagement.dashboard.initialBalance', 'Solde initial')}:</span>{' '}
              {formatCurrency(config.initialBalance)}
            </div>
          </div>
        )}
        
        {/* Configuration des comptes de projection - visible uniquement en mode édition */}
        {isEditingConfig && (
          <AccountProjectionManager
            accountConfigs={tempConfig.accountConfigs || []}
            onConfigsChange={handleAccountConfigsChange}
            isEditing={isEditingConfig}
          />
        )}
      </div>
      
      <AccountSelectionDialog
        isOpen={isAccountSelectionOpen}
        onClose={() => setIsAccountSelectionOpen(false)}
        onSelect={handleAccountSelection}
      />
    </div>
  );
};

export default ProjectionConfig;
