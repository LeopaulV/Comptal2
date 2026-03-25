import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faEdit } from '@fortawesome/free-solid-svg-icons';
import { RateDefinition, Periodicity } from '../../types/ProjectManagement';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface RateManagerProps {
  rates: RateDefinition[];
  onRatesChange: (rates: RateDefinition[]) => void;
  defaultPeriodicity?: Periodicity;
}

const RateManager: React.FC<RateManagerProps> = ({
  rates,
  onRatesChange,
  defaultPeriodicity = 'monthly',
}) => {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<{
    percentage: string;
    frequency: Periodicity;
    startDate: string;
    endDate: string;
  } | null>(null);

  const periodicityOptions: { value: Periodicity; label: string }[] = [
    { value: 'daily', label: t('projectManagement.periodicity.daily', 'Journalier') },
    { value: 'weekly', label: t('projectManagement.periodicity.weekly', 'Hebdomadaire') },
    { value: 'monthly', label: t('projectManagement.periodicity.monthly', 'Mensuel') },
    { value: 'quarterly', label: t('projectManagement.periodicity.quarterly', 'Trimestriel') },
    { value: 'yearly', label: t('projectManagement.periodicity.yearly', 'Annuel') },
    { value: 'unique', label: t('projectManagement.periodicity.unique', 'Unique') },
  ];

  const handleAddRate = useCallback(() => {
    const newRate: RateDefinition = {
      id: `rate_${Date.now()}`,
      percentage: 0,
      frequency: defaultPeriodicity,
      startDate: new Date(),
    };
    onRatesChange([...rates, newRate]);
    // Démarrer l'édition immédiatement
    setEditingId(newRate.id);
    setEditingValues({
      percentage: '0',
      frequency: defaultPeriodicity,
      startDate: format(newRate.startDate, 'yyyy-MM-dd'),
      endDate: '',
    });
  }, [rates, onRatesChange, defaultPeriodicity]);

  const handleDeleteRate = useCallback((id: string) => {
    onRatesChange(rates.filter(rate => rate.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditingValues(null);
    }
  }, [rates, onRatesChange, editingId]);

  const handleStartEdit = useCallback((rate: RateDefinition) => {
    setEditingId(rate.id);
    setEditingValues({
      percentage: rate.percentage.toString(),
      frequency: rate.frequency,
      startDate: format(rate.startDate, 'yyyy-MM-dd'),
      endDate: rate.endDate ? format(rate.endDate, 'yyyy-MM-dd') : '',
    });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingValues(null);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingId || !editingValues) return;

    const updatedRates = rates.map(rate => {
      if (rate.id === editingId) {
        const startDate = new Date(editingValues.startDate);
        const endDate = editingValues.endDate ? new Date(editingValues.endDate) : undefined;
        
        // Validation basique : date de fin doit être après date de début
        if (endDate && endDate <= startDate) {
          // On ignore la date de fin invalide
          return {
            ...rate,
            percentage: parseFloat(editingValues.percentage) || 0,
            frequency: editingValues.frequency,
            startDate,
            endDate: undefined,
          };
        }

        return {
          ...rate,
          percentage: parseFloat(editingValues.percentage) || 0,
          frequency: editingValues.frequency,
          startDate,
          endDate,
        };
      }
      return rate;
    });

    onRatesChange(updatedRates);
    setEditingId(null);
    setEditingValues(null);
  }, [editingId, editingValues, rates, onRatesChange]);

  const handleFieldChange = useCallback((field: 'percentage' | 'frequency' | 'startDate' | 'endDate', value: string | Periodicity) => {
    if (!editingValues) return;
    setEditingValues({
      ...editingValues,
      [field]: value as any,
    });
  }, [editingValues]);

  if (rates.length === 0 && !editingId) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('projectManagement.subscriptionTable.rate', 'Taux')}
          </label>
          <button
            onClick={handleAddRate}
            className="px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faPlus} size="sm" />
            {t('projectManagement.subscriptionTable.addRate', 'Ajouter un taux')}
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          {t('projectManagement.subscriptionTable.noRates', 'Aucun taux défini')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('projectManagement.subscriptionTable.rate', 'Taux')}
        </label>
        <button
          onClick={handleAddRate}
          className="px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faPlus} size="sm" />
          {t('projectManagement.subscriptionTable.addRate', 'Ajouter un taux')}
        </button>
      </div>

      <div className="space-y-2">
        {rates.map((rate) => {
          const isEditing = editingId === rate.id;

          return (
            <div
              key={rate.id}
              className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700/50"
            >
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Date de début */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        {t('projectManagement.subscriptionTable.startDate', 'Date de début')}
                      </label>
                      <input
                        type="date"
                        value={editingValues?.startDate || ''}
                        onChange={(e) => handleFieldChange('startDate', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    {/* Date de fin */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        {t('projectManagement.subscriptionTable.endDate', 'Date de fin')} ({t('common.or', 'ou')} {t('common.none', 'Aucun')})
                      </label>
                      <input
                        type="date"
                        value={editingValues?.endDate || ''}
                        onChange={(e) => handleFieldChange('endDate', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder={t('projectManagement.subscriptionTable.optional', 'Optionnel')}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Pourcentage */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        {t('projectManagement.subscriptionTable.percentage', 'Pourcentage')}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={editingValues?.percentage || '0'}
                          onChange={(e) => handleFieldChange('percentage', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <span className="text-gray-600 dark:text-gray-400 text-sm">%</span>
                      </div>
                    </div>

                    {/* Fréquence */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        {t('projectManagement.subscriptionTable.frequency', 'Fréquence')}
                      </label>
                      <select
                        value={editingValues?.frequency || 'monthly'}
                        onChange={(e) => handleFieldChange('frequency', e.target.value as Periodicity)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {periodicityOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Boutons d'action */}
                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                    >
                      {t('common.cancel', 'Annuler')}
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors"
                    >
                      {t('common.save', 'Enregistrer')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">
                        {t('projectManagement.subscriptionTable.startDate', 'Date de début')}:
                      </span>
                      <div className="text-gray-900 dark:text-gray-100 font-medium">
                        {format(rate.startDate, 'dd/MM/yyyy', { locale: fr })}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">
                        {t('projectManagement.subscriptionTable.endDate', 'Date de fin')}:
                      </span>
                      <div className="text-gray-900 dark:text-gray-100 font-medium">
                        {rate.endDate ? format(rate.endDate, 'dd/MM/yyyy', { locale: fr }) : '-'}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">
                        {t('projectManagement.subscriptionTable.percentage', 'Pourcentage')}:
                      </span>
                      <div className="text-gray-900 dark:text-gray-100 font-medium">
                        {rate.percentage.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">
                        {t('projectManagement.subscriptionTable.frequency', 'Fréquence')}:
                      </span>
                      <div className="text-gray-900 dark:text-gray-100 font-medium">
                        {periodicityOptions.find(opt => opt.value === rate.frequency)?.label || rate.frequency}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleStartEdit(rate)}
                      className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                      title={t('common.edit', 'Modifier')}
                    >
                      <FontAwesomeIcon icon={faEdit} size="sm" />
                    </button>
                    <button
                      onClick={() => handleDeleteRate(rate.id)}
                      className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                      title={t('common.delete', 'Supprimer')}
                    >
                      <FontAwesomeIcon icon={faTrash} size="sm" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RateManager;
