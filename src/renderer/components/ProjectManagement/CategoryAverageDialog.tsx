import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfigService } from '../../services/ConfigService';
import { DataService } from '../../services/DataService';
import { CategoriesConfig } from '../../types/Category';
import { Subscription } from '../../types/ProjectManagement';
import { differenceInMonths } from 'date-fns';
import { formatCurrency } from '../../utils/format';

interface CategoryAverageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onValidate: (subscription: Subscription) => void;
}

const CategoryAverageDialog: React.FC<CategoryAverageDialogProps> = ({
  isOpen,
  onClose,
  onValidate,
}) => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<CategoriesConfig>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [average, setAverage] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les catégories au montage
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await ConfigService.loadCategories();
        setCategories(cats);
      } catch (error) {
        console.error('Erreur lors du chargement des catégories:', error);
      }
    };
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  // Calculer la moyenne quand les paramètres changent
  useEffect(() => {
    if (isOpen && selectedCategory && startDate && endDate) {
      calculateAverage();
    } else {
      setAverage(null);
      setError(null);
    }
  }, [selectedCategory, startDate, endDate, isOpen]);

  const calculateAverage = useCallback(async () => {
    if (!selectedCategory || !startDate || !endDate) {
      return;
    }

    setIsCalculating(true);
    setError(null);

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        setError('La date de début doit être antérieure à la date de fin');
        setAverage(null);
        setIsCalculating(false);
        return;
      }

      // Filtrer les transactions par catégorie et période
      const transactions = await DataService.filterTransactions({
        categoryCodes: [selectedCategory],
        startDate: start,
        endDate: end,
      });

      if (transactions.length === 0) {
        setAverage(0);
        setError(t('projectManagement.subscriptionTable.categoryAverageDialog.noData', 'Aucune donnée disponible pour cette catégorie sur cette période'));
        setIsCalculating(false);
        return;
      }

      // Calculer le total des montants absolus
      const totalAmount = transactions.reduce(
        (sum, t) => sum + Math.abs(t.amount),
        0
      );

      // Calculer le nombre de mois dans la période
      const months = differenceInMonths(end, start) + 1;

      // Calculer la moyenne mensuelle
      const monthlyAverage = months > 0 ? totalAmount / months : 0;
      setAverage(monthlyAverage);
      setError(null);
    } catch (err: any) {
      console.error('Erreur lors du calcul de la moyenne:', err);
      setError('Erreur lors du calcul de la moyenne');
      setAverage(null);
    } finally {
      setIsCalculating(false);
    }
  }, [selectedCategory, startDate, endDate, t]);

  const handleValidate = useCallback(() => {
    if (!selectedCategory || !startDate || !endDate || average === null || average === 0) {
      return;
    }

    const category = categories[selectedCategory];
    if (!category) {
      return;
    }

    const newSubscription: Subscription = {
      id: `sub_${Date.now()}`,
      name: `${category.name} (moyenne)`,
      amount: average,
      periodicity: 'monthly',
      type: 'debit', // Par défaut débit, l'utilisateur pourra changer
      startDate: new Date(),
      categoryCode: selectedCategory,
      color: category.color || '#0ea5e9',
    };

    onValidate(newSubscription);
    // Réinitialiser le formulaire
    setSelectedCategory('');
    setStartDate('');
    setEndDate('');
    setAverage(null);
    setError(null);
    onClose();
  }, [selectedCategory, startDate, endDate, average, categories, onValidate, onClose]);

  const handleClose = useCallback(() => {
    setSelectedCategory('');
    setStartDate('');
    setEndDate('');
    setAverage(null);
    setError(null);
    onClose();
  }, [onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {t('projectManagement.subscriptionTable.categoryAverageDialog.title', 'Créer depuis moyenne de catégorie')}
        </h2>

        <div className="space-y-4">
          {/* Sélecteur de catégorie */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('projectManagement.subscriptionTable.categoryAverageDialog.selectCategory', 'Sélectionner une catégorie')}
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('projectManagement.subscriptionTable.noCategory', 'Aucune')}</option>
              {Object.entries(categories)
                .sort(([, a], [, b]) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
                .map(([code, category]) => (
                  <option key={code} value={code}>{category.name}</option>
                ))}
            </select>
          </div>

          {/* Sélecteur de période */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('projectManagement.subscriptionTable.categoryAverageDialog.selectPeriod', 'Sélectionner une période')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {t('projectManagement.subscriptionTable.categoryAverageDialog.startDate', 'Date de début')}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {t('projectManagement.subscriptionTable.categoryAverageDialog.endDate', 'Date de fin')}
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Affichage de la moyenne */}
          {(isCalculating || average !== null) && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              {isCalculating ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('projectManagement.subscriptionTable.categoryAverageDialog.calculating', 'Calcul en cours...')}
                </p>
              ) : average !== null && (
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('projectManagement.subscriptionTable.categoryAverageDialog.calculatedAverage', 'Moyenne mensuelle calculée')}
                  </p>
                  <p className="text-lg font-semibold text-primary-600 dark:text-primary-400">
                    {formatCurrency(average)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Message d'erreur */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Boutons */}
          <div className="flex gap-3 justify-end pt-4">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {t('projectManagement.subscriptionTable.categoryAverageDialog.cancel', 'Annuler')}
            </button>
            <button
              onClick={handleValidate}
              disabled={!selectedCategory || !startDate || !endDate || average === null || average === 0 || isCalculating}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('projectManagement.subscriptionTable.categoryAverageDialog.validate', 'Valider')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryAverageDialog;
