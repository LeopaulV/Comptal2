import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faCopy, faCog, faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { Subscription, Periodicity, RateDefinition, FiscalCategory, FISCAL_CATEGORIES } from '../../types/ProjectManagement';
import { CategoriesConfig } from '../../types/Category';
import { ConfigService } from '../../services/ConfigService';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatCurrency } from '../../utils/format';
import CategoryAverageDialog from './CategoryAverageDialog';
import TransactionSearchDialog from './TransactionSearchDialog';
import RateManager from './RateManager';

interface SubscriptionTableProps {
  subscriptions: Subscription[];
  onSubscriptionsChange: (subscriptions: Subscription[]) => void;
}

// Helper to calculate group totals recursively
const calculateGroupTotals = (sub: Subscription): { amount: number; type: 'debit' | 'credit' } => {
  if (!sub.isGroup || !sub.children || sub.children.length === 0) {
    return { amount: sub.amount, type: sub.type };
  }

  let total = 0;
  for (const child of sub.children) {
    const childTotals = calculateGroupTotals(child);
    const childAmount = childTotals.type === 'debit' ? -Math.abs(childTotals.amount) : Math.abs(childTotals.amount);
    total += childAmount;
  }

  return {
    amount: Math.abs(total),
    type: total >= 0 ? 'credit' : 'debit'
  };
};

const SubscriptionTable: React.FC<SubscriptionTableProps> = ({
  subscriptions,
  onSubscriptionsChange,
}) => {
  const { t } = useTranslation();
  // Utiliser l'ID au lieu de l'index pour l'édition
  const [editingId, setEditingId] = useState<{ id: string; field: string } | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [categories, setCategories] = useState<CategoriesConfig>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set()); // Pour les options avancées
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set()); // Pour les groupes
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeGroupMenuId, setActiveGroupMenuId] = useState<string | null>(null);
  const [groupMenuPosition, setGroupMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    loadCategories();
  }, []);

  // Fermer le menu quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      
      // Fermer le menu des groupes si on clique en dehors
      if (activeGroupMenuId) {
        const target = event.target as Element;
        // Si le clic n'est pas dans le menu spécifique du groupe actif
        if (!target.closest(`[data-group-menu-id="${activeGroupMenuId}"]`) && !target.closest(`[data-group-trigger-id="${activeGroupMenuId}"]`)) {
          setActiveGroupMenuId(null);
        }
      }
    };

    if (isMenuOpen || activeGroupMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isMenuOpen, activeGroupMenuId]);

  const periodicityOptions: { value: Periodicity; label: string }[] = [
    { value: 'daily', label: t('projectManagement.periodicity.daily', 'Journalier') },
    { value: 'weekly', label: t('projectManagement.periodicity.weekly', 'Hebdomadaire') },
    { value: 'monthly', label: t('projectManagement.periodicity.monthly', 'Mensuel') },
    { value: 'quarterly', label: t('projectManagement.periodicity.quarterly', 'Trimestriel') },
    { value: 'yearly', label: t('projectManagement.periodicity.yearly', 'Annuel') },
    { value: 'unique', label: t('projectManagement.periodicity.unique', 'Unique') },
  ];

  // --- Helpers pour manipuler l'arbre ---

  const findSubscription = (subs: Subscription[], id: string): Subscription | null => {
    for (const sub of subs) {
      if (sub.id === id) return sub;
      if (sub.children) {
        const found = findSubscription(sub.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const updateSubscriptionInTree = (subs: Subscription[], id: string, updater: (sub: Subscription) => Subscription): Subscription[] => {
    return subs.map(sub => {
      if (sub.id === id) {
        return updater(sub);
      }
      if (sub.children) {
        return { ...sub, children: updateSubscriptionInTree(sub.children, id, updater) };
      }
      return sub;
    });
  };

  const deleteSubscriptionInTree = (subs: Subscription[], id: string): Subscription[] => {
    return subs.filter(sub => sub.id !== id).map(sub => {
      if (sub.children) {
        return { ...sub, children: deleteSubscriptionInTree(sub.children, id) };
      }
      return sub;
    });
  };

  const addChildToGroup = (subs: Subscription[], groupId: string, newChild: Subscription): Subscription[] => {
    return subs.map(sub => {
      if (sub.id === groupId) {
        return { ...sub, children: [...(sub.children || []), newChild] };
      }
      if (sub.children) {
        return { ...sub, children: addChildToGroup(sub.children, groupId, newChild) };
      }
      return sub;
    });
  };

  const handleGroupMenuTrigger = (e: React.MouseEvent<HTMLButtonElement>, subscriptionId: string) => {
    if (activeGroupMenuId === subscriptionId) {
      setActiveGroupMenuId(null);
      setGroupMenuPosition(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      // Calculer la position pour le menu (aligné à droite du bouton, en dessous)
      // On utilise fixed positioning via Portal donc les coordonnées sont relatives au viewport
      setGroupMenuPosition({
        top: rect.bottom + window.scrollY,
        left: rect.right, // On alignera le côté droit du menu avec le côté droit du bouton
      });
      setActiveGroupMenuId(subscriptionId);
    }
  };

  // Fermer le menu au scroll
  useEffect(() => {
    const handleScroll = () => {
      if (activeGroupMenuId) {
        setActiveGroupMenuId(null);
        setGroupMenuPosition(null);
      }
    };
    
    window.addEventListener('scroll', handleScroll, true); // true pour capturer le scroll des conteneurs parents
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [activeGroupMenuId]);

  // --- Handlers ---

  const handleAddRow = useCallback(() => {
    const newSubscription: Subscription = {
      id: `sub_${Date.now()}`,
      name: '',
      amount: 0,
      periodicity: 'monthly',
      type: 'debit',
      startDate: new Date(),
      color: '#0ea5e9',
    };
    onSubscriptionsChange([...subscriptions, newSubscription]);
  }, [subscriptions, onSubscriptionsChange]);

  const handleAddGroup = useCallback(() => {
    const newGroup: Subscription = {
      id: `grp_${Date.now()}`,
      name: 'Nouveau Groupe',
      amount: 0,
      periodicity: 'monthly',
      type: 'debit',
      startDate: new Date(),
      color: '#0ea5e9',
      isGroup: true,
      children: [],
    };
    // Auto-expand le nouveau groupe
    setExpandedGroups(prev => new Set(prev).add(newGroup.id));
    onSubscriptionsChange([...subscriptions, newGroup]);
  }, [subscriptions, onSubscriptionsChange]);

  const handleAddChildGroup = useCallback((parentId: string) => {
    const newGroup: Subscription = {
      id: `grp_${Date.now()}`,
      name: 'Nouveau sous-groupe',
      amount: 0,
      periodicity: 'monthly',
      type: 'debit',
      startDate: new Date(),
      color: '#0ea5e9',
      isGroup: true,
      children: [],
    };
    
    setExpandedGroups(prev => new Set(prev).add(parentId).add(newGroup.id));
    onSubscriptionsChange(addChildToGroup(subscriptions, parentId, newGroup));
  }, [subscriptions, onSubscriptionsChange]);

  const handleAddChild = useCallback((parentId: string) => {
    const newChild: Subscription = {
      id: `sub_${Date.now()}`,
      name: '',
      amount: 0,
      periodicity: 'monthly',
      type: 'debit',
      startDate: new Date(),
      color: '#0ea5e9',
    };
    
    // S'assurer que le groupe est ouvert
    setExpandedGroups(prev => new Set(prev).add(parentId));
    
    onSubscriptionsChange(addChildToGroup(subscriptions, parentId, newChild));
  }, [subscriptions, onSubscriptionsChange]);

  const handleDeleteRow = useCallback((id: string) => {
    const activeElement = document.activeElement;
    if (activeElement && activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
    
    if (editingId && editingId.id === id) {
      setEditingId(null);
      setEditingValue('');
    }
    
    setTimeout(() => {
      onSubscriptionsChange(deleteSubscriptionInTree(subscriptions, id));
    }, 10);
  }, [subscriptions, onSubscriptionsChange, editingId]);

  const handleDuplicateRow = useCallback((id: string) => {
    // Cette fonction est simplifiée et ne supporte pas bien la duplication profonde pour l'instant
    // Idéalement il faudrait trouver le parent et insérer le dupliqué à côté
    // Pour l'instant on fait simple : on ne supporte la duplication que au niveau racine ou on demande à l'utilisateur de refaire
    // TODO: Améliorer duplication imbriquée
    const subToDuplicate = findSubscription(subscriptions, id);
    if (!subToDuplicate) return;

    const duplicateSub = (sub: Subscription): Subscription => ({
      ...sub,
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${sub.name} (copie)`,
      children: sub.children ? sub.children.map(duplicateSub) : undefined,
    });

    const duplicated = duplicateSub(subToDuplicate);
    
    // Si c'est à la racine
    if (subscriptions.some(s => s.id === id)) {
       const index = subscriptions.findIndex(s => s.id === id);
       const newSubs = [...subscriptions];
       newSubs.splice(index + 1, 0, duplicated);
       onSubscriptionsChange(newSubs);
    } else {
        // C'est un enfant, c'est plus compliqué sans référence au parent...
        // On va tricher et l'ajouter à la fin de la racine pour l'instant si on ne trouve pas mieux
        // Ou mieux, on refait une fonction récursive qui insère après
        const insertDuplicate = (subs: Subscription[]): Subscription[] => {
            return subs.reduce((acc, sub) => {
                acc.push(sub);
                if (sub.id === id) {
                    acc.push(duplicated);
                } else if (sub.children) {
                    // On modifie l'objet existant dans l'accumulateur (attention aux mutations, mais ici on reconstruit)
                    // En fait non, il faut reconstruire proprement
                    const last = acc[acc.length - 1];
                    last.children = insertDuplicate(sub.children);
                }
                return acc;
            }, [] as Subscription[]);
        };
        onSubscriptionsChange(insertDuplicate(subscriptions));
    }
  }, [subscriptions, onSubscriptionsChange]);

  const handleCellFocus = useCallback((id: string, field: string) => {
    const sub = findSubscription(subscriptions, id);
    if (!sub) return;

    let value = '';
    
    switch (field) {
      case 'name':
        value = sub.name || '';
        break;
      case 'amount':
        value = Math.abs(sub.amount).toString();
        break;
      case 'startDate':
        value = format(sub.startDate, 'yyyy-MM-dd');
        break;
      case 'endDate':
        value = sub.endDate ? format(sub.endDate, 'yyyy-MM-dd') : '';
        break;
      case 'categoryCode':
        value = sub.categoryCode || '';
        break;
      case 'color':
        value = sub.color || '#0ea5e9';
        break;
    }
    
    setEditingId({ id, field });
    setEditingValue(value);
  }, [subscriptions]);

  const handleCellBlur = useCallback(() => {
    if (!editingId) return;
    
    const { id, field } = editingId;
    
    const updater = (sub: Subscription): Subscription => {
      const updated = { ...sub };
      switch (field) {
        case 'name':
          updated.name = editingValue.trim();
          break;
        case 'amount':
          // Pour les groupes, le montant est calculé, pas édité directement (sauf si on veut l'override ?)
          // La demande dit "automatiquement en fonction du Montant", donc lecture seule pour les groupes.
          // Mais ici on gère l'édition générique.
          if (!sub.isGroup) {
              const amount = parseFloat(editingValue) || 0;
              updated.amount = Math.max(0, amount);
          }
          break;
        case 'startDate':
          const startDate = new Date(editingValue);
          if (!isNaN(startDate.getTime())) {
            updated.startDate = startDate;
          }
          break;
        case 'endDate':
          if (editingValue.trim()) {
            const endDate = new Date(editingValue);
            if (!isNaN(endDate.getTime())) {
              updated.endDate = endDate;
            }
          } else {
            updated.endDate = undefined;
          }
          break;
        case 'categoryCode':
          updated.categoryCode = editingValue || undefined;
          break;
        case 'color':
          updated.color = editingValue || '#0ea5e9';
          break;
      }
      return updated;
    };

    onSubscriptionsChange(updateSubscriptionInTree(subscriptions, id, updater));
    setEditingId(null);
    setEditingValue('');
  }, [editingId, editingValue, subscriptions, onSubscriptionsChange]);

  const handleCellChange = useCallback((value: string) => {
    setEditingValue(value);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditingValue('');
    }
  }, [handleCellBlur]);

  const handleTypeChange = useCallback((id: string, type: 'debit' | 'credit') => {
    onSubscriptionsChange(updateSubscriptionInTree(subscriptions, id, sub => ({ ...sub, type })));
  }, [subscriptions, onSubscriptionsChange]);

  const handlePeriodicityChange = useCallback((id: string, periodicity: Periodicity) => {
     onSubscriptionsChange(updateSubscriptionInTree(subscriptions, id, sub => ({ ...sub, periodicity })));
  }, [subscriptions, onSubscriptionsChange]);

  const handleCategoryChange = useCallback((id: string, categoryCode: string) => {
    const sub = findSubscription(subscriptions, id);
    if (!sub) return;

    let updatedColor = sub.color || '#0ea5e9';
    if (categoryCode && categories[categoryCode]) {
      updatedColor = categories[categoryCode].color;
    }

    onSubscriptionsChange(updateSubscriptionInTree(subscriptions, id, s => ({
        ...s,
        categoryCode: categoryCode || undefined,
        color: updatedColor
    })));
  }, [subscriptions, onSubscriptionsChange, categories]);

  const handleColorChange = useCallback((id: string, color: string) => {
    onSubscriptionsChange(updateSubscriptionInTree(subscriptions, id, s => ({ ...s, color: color || '#0ea5e9' })));
  }, [subscriptions, onSubscriptionsChange]);

  const handleFiscalCategoryChange = useCallback((id: string, fiscalCategory: string) => {
    onSubscriptionsChange(updateSubscriptionInTree(subscriptions, id, s => ({
      ...s,
      fiscalCategory: (fiscalCategory || undefined) as FiscalCategory | undefined,
    })));
  }, [subscriptions, onSubscriptionsChange]);

  const handleTvaRateChange = useCallback((id: string, tvaRate: string) => {
    const value = parseFloat(tvaRate);
    onSubscriptionsChange(updateSubscriptionInTree(subscriptions, id, s => ({
      ...s,
      tvaRate: isNaN(value) ? undefined : value,
    })));
  }, [subscriptions, onSubscriptionsChange]);

  const toggleAdvancedSettings = useCallback((subscriptionId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subscriptionId)) {
        newSet.delete(subscriptionId);
      } else {
        newSet.add(subscriptionId);
      }
      return newSet;
    });
  }, []);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  }, []);

  // Conservé pour une utilisation future avec creditIndicator
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // @ts-expect-error - Fonction conservée pour utilisation future
  const handleAdvancedSettingsChange = useCallback((id: string, field: 'rate' | 'creditIndicator', subField: 'percentage' | 'amount' | 'frequency', value: number | Periodicity) => {
    const updater = (subscription: Subscription): Subscription => {
        const newSub = { ...subscription };
        if (!newSub.advancedSettings) {
            newSub.advancedSettings = {};
        }
        
        if (field === 'rate' && !newSub.advancedSettings.rate) {
            newSub.advancedSettings.rate = { percentage: 0, frequency: 'monthly' };
        }
        if (field === 'creditIndicator' && !newSub.advancedSettings.creditIndicator) {
            newSub.advancedSettings.creditIndicator = { amount: 0, frequency: 'monthly' };
        }
        
        if (subField === 'percentage' || subField === 'amount') {
            (newSub.advancedSettings[field] as any)[subField] = value as number;
        } else {
            (newSub.advancedSettings[field] as any)[subField] = value as Periodicity;
        }
        
        // Clean up
        if (field === 'rate' && newSub.advancedSettings.rate?.percentage === 0) delete newSub.advancedSettings.rate;
        if (field === 'creditIndicator' && newSub.advancedSettings.creditIndicator?.amount === 0) delete newSub.advancedSettings.creditIndicator;
        if (!newSub.advancedSettings.rate && !newSub.advancedSettings.creditIndicator) newSub.advancedSettings = undefined;

        return newSub;
    };

    onSubscriptionsChange(updateSubscriptionInTree(subscriptions, id, updater));
  }, [subscriptions, onSubscriptionsChange]);

  // Migrer l'ancien rate vers rates si nécessaire
  const migrateRateToRates = useCallback((subscription: Subscription): RateDefinition[] => {
    if (!subscription.advancedSettings) {
      return [];
    }

    // Si rates existe déjà, l'utiliser
    if (subscription.advancedSettings.rates && subscription.advancedSettings.rates.length > 0) {
      return subscription.advancedSettings.rates;
    }

    // Sinon, migrer l'ancien rate vers rates
    if (subscription.advancedSettings.rate && subscription.advancedSettings.rate.percentage > 0) {
      const migratedRate: RateDefinition = {
        id: `rate_migrated_${subscription.id}_${Date.now()}`,
        percentage: subscription.advancedSettings.rate.percentage,
        frequency: subscription.advancedSettings.rate.frequency,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
      };
      return [migratedRate];
    }

    return [];
  }, []);

  // Gérer les changements de taux via RateManager
  const handleRatesChange = useCallback((subscriptionId: string, newRates: RateDefinition[]) => {
    const updater = (subscription: Subscription): Subscription => {
      const newSub = { ...subscription };
      if (!newSub.advancedSettings) {
        newSub.advancedSettings = {};
      }

      // Mettre à jour rates
      if (newRates.length > 0) {
        newSub.advancedSettings.rates = newRates;
        // Supprimer l'ancien rate si présent
        delete newSub.advancedSettings.rate;
      } else {
        // Si aucun taux, nettoyer
        delete newSub.advancedSettings.rates;
        delete newSub.advancedSettings.rate;
      }

      // Nettoyer advancedSettings si vide
      if (!newSub.advancedSettings.rates && !newSub.advancedSettings.creditIndicator) {
        newSub.advancedSettings = undefined;
      }

      return newSub;
    };

    onSubscriptionsChange(updateSubscriptionInTree(subscriptions, subscriptionId, updater));
  }, [subscriptions, onSubscriptionsChange]);

  const handleAddFromCategory = useCallback((parentId: string | null = null) => {
    const targetId = typeof parentId === 'string' ? parentId : null;
    
    setTargetParentId(targetId);
    setIsMenuOpen(false);
    setActiveGroupMenuId(null);
    setIsCategoryDialogOpen(true);
  }, []);

  const handleAddFromTransaction = useCallback((parentId: string | null = null) => {
    const targetId = typeof parentId === 'string' ? parentId : null;
    
    setTargetParentId(targetId);
    setIsMenuOpen(false);
    setActiveGroupMenuId(null);
    setIsTransactionDialogOpen(true);
  }, []);

  const handleCategoryDialogValidate = useCallback((subscription: Subscription) => {
    if (targetParentId) {
      setExpandedGroups(prev => new Set(prev).add(targetParentId));
      onSubscriptionsChange(addChildToGroup(subscriptions, targetParentId, subscription));
    } else {
      onSubscriptionsChange([...subscriptions, subscription]);
    }
    setTargetParentId(null);
  }, [subscriptions, onSubscriptionsChange, targetParentId]);

  const handleTransactionDialogValidate = useCallback((subscription: Subscription) => {
    if (targetParentId) {
      setExpandedGroups(prev => new Set(prev).add(targetParentId));
      onSubscriptionsChange(addChildToGroup(subscriptions, targetParentId, subscription));
    } else {
      onSubscriptionsChange([...subscriptions, subscription]);
    }
    setTargetParentId(null);
  }, [subscriptions, onSubscriptionsChange, targetParentId]);


  // --- Render Row ---
  
  const renderRow = (subscription: Subscription, level: number = 0) => {
    const isGroup = subscription.isGroup;
    const isExpanded = expandedGroups.has(subscription.id);
    const hasChildren = subscription.children && subscription.children.length > 0;
    
    // Calculs pour le groupe
    const groupTotals = isGroup ? calculateGroupTotals(subscription) : null;
    const displayAmount = isGroup ? groupTotals!.amount : subscription.amount;
    const displayType = isGroup ? groupTotals!.type : subscription.type;

    const isEditingName = editingId?.id === subscription.id && editingId?.field === 'name';
    const isEditingAmount = editingId?.id === subscription.id && editingId?.field === 'amount';
    const isEditingStartDate = editingId?.id === subscription.id && editingId?.field === 'startDate';
    const isEditingEndDate = editingId?.id === subscription.id && editingId?.field === 'endDate';

    return (
      <React.Fragment key={subscription.id}>
        <tr className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${isGroup ? 'bg-gray-50 dark:bg-gray-800/20 font-medium' : ''} text-gray-900 dark:text-gray-100`}>
          <td className="px-4 py-2 border border-gray-300 dark:border-gray-600">
            <div className="flex items-center" style={{ paddingLeft: `${level * 20}px` }}>
              {isGroup && (
                <button 
                  onClick={() => toggleGroup(subscription.id)}
                  className="mr-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
                >
                  <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} size="sm" />
                </button>
              )}
              {!isGroup && level > 0 && <span className="w-6" />} {/* Spacer for non-group items at nested levels */}
              
              {isEditingName ? (
                <input
                  type="text"
                  value={editingValue}
                  onChange={(e) => handleCellChange(e.target.value)}
                  onBlur={handleCellBlur}
                  onKeyDown={handleKeyDown}
                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              ) : (
                <div
                  onClick={() => handleCellFocus(subscription.id, 'name')}
                  className="cursor-pointer min-h-[32px] flex items-center flex-1"
                >
                  {subscription.name || <span className="text-gray-400 italic">Cliquez pour éditer</span>}
                </div>
              )}
            </div>
          </td>
          
          <td className="px-4 py-2 border border-gray-300 dark:border-gray-600">
            {isGroup ? (
               <span className={`px-2 py-1 rounded text-xs font-semibold ${
                   displayType === 'credit' 
                   ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                   : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
               }`}>
                 {displayType === 'debit' ? t('projectManagement.subscriptionTable.debit', 'Débit') : t('projectManagement.subscriptionTable.credit', 'Crédit')}
               </span>
            ) : (
              <select
                value={subscription.type}
                onChange={(e) => handleTypeChange(subscription.id, e.target.value as 'debit' | 'credit')}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="debit">{t('projectManagement.subscriptionTable.debit', 'Débit')}</option>
                <option value="credit">{t('projectManagement.subscriptionTable.credit', 'Crédit')}</option>
              </select>
            )}
          </td>

          <td className="px-4 py-2 border border-gray-300 dark:border-gray-600">
            {isGroup ? (
                 <div className="font-bold">
                    {formatCurrency(displayType === 'debit' ? -displayAmount : displayAmount)}
                 </div>
            ) : isEditingAmount ? (
              <input
                type="number"
                step="0.01"
                min="0"
                value={editingValue}
                onChange={(e) => handleCellChange(e.target.value)}
                onBlur={handleCellBlur}
                onKeyDown={handleKeyDown}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
            ) : (
              <div
                onClick={() => handleCellFocus(subscription.id, 'amount')}
                className="cursor-pointer min-h-[32px] flex items-center"
              >
                {formatCurrency(
                  subscription.type === 'debit'
                    ? -Math.abs(subscription.amount)
                    : subscription.amount
                )}
              </div>
            )}
          </td>

          <td className="px-4 py-2 border border-gray-300 dark:border-gray-600">
            {isGroup ? (
                 <span className="text-gray-500 dark:text-gray-400 text-sm italic">
                    {t('projectManagement.subscriptionTable.various', 'Divers')}
                 </span>
            ) : (
                <select
                value={subscription.periodicity}
                onChange={(e) => handlePeriodicityChange(subscription.id, e.target.value as Periodicity)}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                {periodicityOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
                </select>
            )}
          </td>

          <td className="px-4 py-2 border border-gray-300 dark:border-gray-600">
            {isEditingStartDate ? (
              <input
                type="date"
                value={editingValue}
                onChange={(e) => handleCellChange(e.target.value)}
                onBlur={handleCellBlur}
                onKeyDown={handleKeyDown}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
            ) : (
              <div
                onClick={() => handleCellFocus(subscription.id, 'startDate')}
                className="cursor-pointer min-h-[32px] flex items-center"
              >
                {format(subscription.startDate, 'dd/MM/yyyy', { locale: fr })}
              </div>
            )}
          </td>

          <td className="px-4 py-2 border border-gray-300 dark:border-gray-600">
            {isEditingEndDate ? (
              <input
                type="date"
                value={editingValue}
                onChange={(e) => handleCellChange(e.target.value)}
                onBlur={handleCellBlur}
                onKeyDown={handleKeyDown}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
            ) : (
              <div
                onClick={() => handleCellFocus(subscription.id, 'endDate')}
                className="cursor-pointer min-h-[32px] flex items-center"
              >
                {subscription.endDate ? format(subscription.endDate, 'dd/MM/yyyy', { locale: fr }) : '-'}
              </div>
            )}
          </td>

          <td className="px-4 py-2 border border-gray-300 dark:border-gray-600">
            <select
              value={subscription.categoryCode || ''}
              onChange={(e) => handleCategoryChange(subscription.id, e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('projectManagement.subscriptionTable.noCategory', 'Aucune')}</option>
              {Object.entries(categories)
                .sort(([, a], [, b]) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
                .map(([code, category]) => (
                  <option key={code} value={code}>{category.name}</option>
                ))}
            </select>
          </td>

          <td className="px-4 py-2 border border-gray-300 dark:border-gray-600">
            <input
              type="color"
              value={subscription.color || '#0ea5e9'}
              onChange={(e) => handleColorChange(subscription.id, e.target.value)}
              className="w-full h-8 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 cursor-pointer"
              title={t('projectManagement.subscriptionTable.color', 'Couleur')}
            />
          </td>

          <td className="px-4 py-2 border border-gray-300 dark:border-gray-600">
            {!isGroup && (
              <select
                value={subscription.fiscalCategory || ''}
                onChange={(e) => handleFiscalCategoryChange(subscription.id, e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
              >
                <option value="">{t('invoicing.charges.selectFiscalCategory', '—')}</option>
                {FISCAL_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>
                    {t(`invoicing.charges.categories.${cat}`, cat)}
                  </option>
                ))}
              </select>
            )}
          </td>

          <td className="px-4 py-2 border border-gray-300 dark:border-gray-600">
            <div className="flex gap-2 justify-center relative">
              {isGroup && (
                <>
                    <button
                        onClick={(e) => handleGroupMenuTrigger(e, subscription.id)}
                        className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                        title={t('projectManagement.subscriptionTable.addChild', 'Ajouter une ligne')}
                        data-group-trigger-id={subscription.id}
                    >
                        <FontAwesomeIcon icon={faPlus} />
                    </button>
                    {activeGroupMenuId === subscription.id && groupMenuPosition && createPortal(
                        <div 
                            className="fixed bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-300 dark:border-gray-600 z-[9999] text-left w-48"
                            style={{ 
                                top: groupMenuPosition.top, 
                                left: groupMenuPosition.left - 192, // 192px = w-48 (48 * 4)
                            }}
                            data-group-menu-id={subscription.id}
                        >
                            <button
                                onClick={() => {
                                    setActiveGroupMenuId(null);
                                    handleAddChild(subscription.id);
                                }}
                                className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors first:rounded-t-lg text-sm"
                            >
                                {t('projectManagement.subscriptionTable.newEmptyRow', 'Nouvelle ligne')}
                            </button>
                            <button
                                onClick={() => {
                                    setActiveGroupMenuId(null);
                                    handleAddChildGroup(subscription.id);
                                }}
                                className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
                            >
                                {t('projectManagement.subscriptionTable.newGroup', 'Nouveau groupe')}
                            </button>
                            <button
                                onClick={() => handleAddFromCategory(subscription.id)}
                                className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
                            >
                                {t('projectManagement.subscriptionTable.fromCategory', 'Depuis catégorie')}
                            </button>
                            <button
                                onClick={() => handleAddFromTransaction(subscription.id)}
                                className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors last:rounded-b-lg text-sm"
                            >
                                {t('projectManagement.subscriptionTable.fromTransaction', 'Depuis transaction')}
                            </button>
                        </div>,
                        document.body
                    )}
                </>
              )}
              
              {!isGroup && (
                 <button
                    onClick={() => toggleAdvancedSettings(subscription.id)}
                    className={`p-1 rounded transition-colors ${
                    expandedRows.has(subscription.id)
                        ? 'text-primary-600 bg-primary-100 dark:bg-primary-900/30'
                        : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                    }`}
                    title={t('projectManagement.subscriptionTable.advancedOptions', 'Options avancées')}
                >
                    <FontAwesomeIcon icon={faCog} />
                </button>
              )}

              <button
                onClick={() => handleDuplicateRow(subscription.id)}
                className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                title={t('projectManagement.subscriptionTable.duplicate', 'Dupliquer')}
              >
                <FontAwesomeIcon icon={faCopy} />
              </button>
              <button
                onClick={() => handleDeleteRow(subscription.id)}
                className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                title={t('common.delete', 'Supprimer')}
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>
          </td>
        </tr>
        
        {/* Options avancées (seulement pour les feuilles pour l'instant) */}
        {!isGroup && expandedRows.has(subscription.id) && (
          <tr>
            <td colSpan={10} className="px-4 py-4 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/30" style={{ paddingLeft: `${(level * 20) + 16}px` }}>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  {t('projectManagement.subscriptionTable.advancedOptions', 'Options avancées')}
                </h3>
                
                {/* Section Taux */}
                <RateManager
                  rates={migrateRateToRates(subscription)}
                  onRatesChange={(rates) => handleRatesChange(subscription.id, rates)}
                  defaultPeriodicity={subscription.periodicity}
                />

                {/* Taux TVA déductible */}
                <div className="flex items-center gap-3 mt-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {t('invoicing.postes.tva', 'TVA (%)')}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={subscription.tvaRate ?? ''}
                    onChange={(e) => handleTvaRateChange(subscription.id, e.target.value)}
                    placeholder="0"
                    className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {t('invoicing.charges.tva.deductible', 'TVA déductible')}
                  </span>
                </div>
              </div>
            </td>
          </tr>
        )}
        
        {/* Enfants du groupe */}
        {isGroup && isExpanded && hasChildren && (
          subscription.children!.map(child => renderRow(child, level + 1))
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="subscription-table-container">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t('projectManagement.subscriptionTable.title', 'Abonnements')}
        </h2>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faPlus} />
            {t('projectManagement.subscriptionTable.addNew', '+ New')}
            <FontAwesomeIcon icon={faChevronDown} className="text-xs" />
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-300 dark:border-gray-600 z-10">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  handleAddRow();
                }}
                className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors first:rounded-t-lg"
              >
                {t('projectManagement.subscriptionTable.newEmptyRow', 'Nouvelle ligne')}
              </button>
              <button
                onClick={() => {
                    setIsMenuOpen(false);
                    handleAddGroup();
                }}
                className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {t('projectManagement.subscriptionTable.newGroup', 'Nouveau groupe')}
              </button>
              <button
                onClick={() => handleAddFromCategory()}
                className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {t('projectManagement.subscriptionTable.fromCategory', 'Depuis catégorie')}
              </button>
              <button
                onClick={() => handleAddFromTransaction()}
                className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors last:rounded-b-lg"
              >
                {t('projectManagement.subscriptionTable.fromTransaction', 'Depuis transaction')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <CategoryAverageDialog
        isOpen={isCategoryDialogOpen}
        onClose={() => setIsCategoryDialogOpen(false)}
        onValidate={handleCategoryDialogValidate}
      />
      <TransactionSearchDialog
        isOpen={isTransactionDialogOpen}
        onClose={() => setIsTransactionDialogOpen(false)}
        onValidate={handleTransactionDialogValidate}
      />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th className="px-4 py-2 text-left border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('projectManagement.subscriptionTable.name', 'Nom')}
              </th>
              <th className="px-4 py-2 text-left border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('projectManagement.subscriptionTable.type', 'Type')}
              </th>
              <th className="px-4 py-2 text-left border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('projectManagement.subscriptionTable.amount', 'Montant')}
              </th>
              <th className="px-4 py-2 text-left border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('projectManagement.subscriptionTable.periodicity', 'Périodicité')}
              </th>
              <th className="px-4 py-2 text-left border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('projectManagement.subscriptionTable.startDate', 'Date de début')}
              </th>
              <th className="px-4 py-2 text-left border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('projectManagement.subscriptionTable.endDate', 'Date de fin')}
              </th>
              <th className="px-4 py-2 text-left border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('projectManagement.subscriptionTable.category', 'Catégorie')}
              </th>
              <th className="px-4 py-2 text-left border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('projectManagement.subscriptionTable.color', 'Couleur')}
              </th>
              <th className="px-4 py-2 text-left border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('invoicing.charges.fiscalCategory', 'Nature fiscale')}
              </th>
              <th className="px-4 py-2 text-center border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('projectManagement.subscriptionTable.actions', 'Actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600">
                  {t('projectManagement.subscriptionTable.noSubscriptions', 'Aucun abonnement. Cliquez sur "Ajouter" pour en créer un.')}
                </td>
              </tr>
            ) : (
              subscriptions.map(subscription => renderRow(subscription, 0))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SubscriptionTable;
