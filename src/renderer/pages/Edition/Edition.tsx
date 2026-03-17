import React, { useEffect, useState, useMemo, useCallback, useRef, useDeferredValue, startTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from 'use-debounce';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faMagic, faTags, faFilter, faSearch, faCheckCircle, faBroom, faChevronLeft, faChevronRight, faExclamationTriangle, faCircleNotch, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import { Loading, EmptyState } from '../../components/Common';
import SourceFilterPanel from '../../components/Edition/SourceFilterPanel';
import CategoryFilterPanel from '../../components/Edition/CategoryFilterPanel';
import PeriodFilterPanel from '../../components/Edition/PeriodFilterPanel';
import CsvEditorTable, { CsvEditorTableRef } from '../../components/Edition/CsvEditorTable';
import AutoCategorisationReviewModal from '../../components/Edition/AutoCategorisationReviewModal';
import CleanDuplicatesModal from '../../components/Edition/CleanDuplicatesModal';
import CategoryLegendPanel from '../../components/Edition/CategoryLegendPanel';
import { EditionService } from '../../services/EditionService';
import { ConfigService } from '../../services/ConfigService';
import { AutoCategorisationService } from '../../services/AutoCategorisationService';
import { EditionRow, DuplicateRowEntry } from '../../types/Edition';
import { WordStatsMap, PendingAutoCategorisation } from '../../types/AutoCategorisation';
import '../../styles/edition-custom.css';

const Edition: React.FC = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [allRows, setAllRows] = useState<EditionRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showUncategorized, setShowUncategorized] = useState(true);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [activeFilterTab, setActiveFilterTab] = useState<'source' | 'category' | 'period'>('source');
  const [saving, setSaving] = useState(false);
  const [autoCategorisationStats, setAutoCategorisationStats] = useState<WordStatsMap>({});
  const [pendingAutoCategorisation, setPendingAutoCategorisation] = useState<PendingAutoCategorisation[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showCleanDuplicatesModal, setShowCleanDuplicatesModal] = useState(false);
  const [cleanDuplicatesPreview, setCleanDuplicatesPreview] = useState<{ duplicates: DuplicateRowEntry[]; inconsistenciesCount: number }>({ duplicates: [], inconsistenciesCount: 0 });
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);
  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [ignoredFiles, setIgnoredFiles] = useState<Array<{ fileName: string; accountCode: string }>>([]);
  const [categoriesRefreshKey, setCategoriesRefreshKey] = useState(0);
  const csvTableRef = useRef<CsvEditorTableRef>(null);

  useEffect(() => {
    loadData();
    loadAutoCategorisationStats();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setIsDataLoading(true);
    try {
      const data = await EditionService.loadEditionData();
      // Filtrer les colonnes "Solde initial", "Index", "Source" et "Date de valeur" pour ne pas les afficher
      const filteredHeaders = data.headers.filter(
        header => header !== 'Solde initial' && header !== 'Index' && header !== 'Source' && header !== 'Date de valeur'
      );
      setHeaders(filteredHeaders);
      setAllRows(data.rows);
      
      // Stocker les fichiers ignorés pour afficher un avertissement
      setIgnoredFiles(data.ignoredFiles || []);
      
      // Initialiser les sources sélectionnées avec toutes les sources uniques
      const uniqueSources = [...new Set(data.rows.map(row => row.Source))];
      setSelectedSources(uniqueSources);
      
      // Réinitialiser les modifications locales après le chargement
      csvTableRef.current?.clearModifications(true); // true = effacer toutes les modifications
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      toast.error('Erreur lors du chargement des données. Vérifiez la console pour plus de détails.');
    } finally {
      setIsLoading(false);
      setIsDataLoading(false);
    }
  };

  const loadAutoCategorisationStats = async () => {
    try {
      const stats = await ConfigService.loadAutoCategorisationStats();
      setAutoCategorisationStats(stats);
    } catch (error) {
      console.error('Erreur lors du chargement des stats d\'auto-catégorisation:', error);
    }
  };

  // Convertir selectedSources en Set pour accès O(1)
  const selectedSourcesSet = useMemo(() => new Set(selectedSources), [selectedSources]);
  
  // Filtrer les lignes selon les sources sélectionnées
  const filteredBySource = useMemo(() => {
    if (selectedSources.length === 0) return [];
    return allRows.filter(row => selectedSourcesSet.has(row.Source));
  }, [allRows, selectedSourcesSet, selectedSources.length]);

  // Convertir selectedCategories en Set pour accès O(1)
  const selectedCategoriesSet = useMemo(() => new Set(selectedCategories), [selectedCategories]);
  
  // Filtrer les lignes selon les catégories sélectionnées
  const filteredByCategory = useMemo(() => {
    return filteredBySource.filter(row => {
      const category = row.catégorie || '';
      const isEmpty = !category || category.trim() === '' || category === '???';
      
      if (showUncategorized && isEmpty) {
        return true;
      }
      
      if (isEmpty) {
        return false;
      }
      
      return selectedCategoriesSet.has(category);
    });
  }, [filteredBySource, selectedCategoriesSet, selectedCategories.length, showUncategorized]);

  // Utiliser useDeferredValue pour différer les recalculs de filtres non critiques
  const deferredFilteredByCategory = useDeferredValue(filteredByCategory);
  const deferredSearchTerm = useDeferredValue(debouncedSearchTerm);
  
  // Filtrer par période (date)
  const filteredByPeriod = useMemo(() => {
    if (!startDate && !endDate) return deferredFilteredByCategory;
    
    // Fonction pour convertir dd/MM/yyyy en Date
    const parseDate = (dateStr: string): Date | null => {
      if (!dateStr) return null;
      const [day, month, year] = dateStr.split('/');
      if (day && month && year) {
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      return null;
    };
    
    return deferredFilteredByCategory.filter(row => {
      const rowDate = parseDate(row.Date);
      if (!rowDate) return false; // Exclure les lignes sans date valide
      
      // Normaliser les dates pour comparaison (début de journée)
      const rowDateNormalized = new Date(rowDate);
      rowDateNormalized.setHours(0, 0, 0, 0);
      
      // Vérifier la date de début
      if (startDate) {
        const startDateObj = parseDate(startDate);
        if (startDateObj) {
          const startDateNormalized = new Date(startDateObj);
          startDateNormalized.setHours(0, 0, 0, 0);
          if (rowDateNormalized < startDateNormalized) {
            return false;
          }
        }
      }
      
      // Vérifier la date de fin
      if (endDate) {
        const endDateObj = parseDate(endDate);
        if (endDateObj) {
          const endDateNormalized = new Date(endDateObj);
          endDateNormalized.setHours(23, 59, 59, 999);
          if (rowDateNormalized > endDateNormalized) {
            return false;
          }
        }
      }
      
      return true;
    });
  }, [deferredFilteredByCategory, startDate, endDate]);
  
  // Filtrer par recherche textuelle (avec debouncing)
  const filteredBySearch = useMemo(() => {
    if (!deferredSearchTerm.trim()) return filteredByPeriod;
    
    const term = deferredSearchTerm.toLowerCase();
    return filteredByPeriod.filter(row => {
      return Object.values(row).some(value => {
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(term);
      });
    });
  }, [filteredByPeriod, deferredSearchTerm]);

  // Trier les lignes
  const sortedRows = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredBySearch;
    
    return [...filteredBySearch].sort((a, b) => {
      const aValue = a[sortColumn as keyof EditionRow];
      const bValue = b[sortColumn as keyof EditionRow];
      
      // Gestion des dates
      if (sortColumn === 'Date' || sortColumn === 'Date de valeur') {
        const parseDate = (dateStr: string): Date => {
          const [day, month, year] = dateStr.split('/');
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        };
        const aDate = typeof aValue === 'string' ? parseDate(aValue) : new Date(0);
        const bDate = typeof bValue === 'string' ? parseDate(bValue) : new Date(0);
        return sortDirection === 'asc' 
          ? aDate.getTime() - bDate.getTime()
          : bDate.getTime() - aDate.getTime();
      }
      
      // Gestion des valeurs numériques
      if (sortColumn === 'Débit' || sortColumn === 'Crédit' || sortColumn === 'Solde') {
        const aNum = typeof aValue === 'number' ? aValue : parseFloat(String(aValue)) || 0;
        const bNum = typeof bValue === 'number' ? bValue : parseFloat(String(bValue)) || 0;
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      // Tri alphabétique pour les autres colonnes
      const aStr = String(aValue || '').toLowerCase();
      const bStr = String(bValue || '').toLowerCase();
      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }, [filteredBySearch, sortColumn, sortDirection]);

  // Créer une Map d'indexation pour accès O(1) aux lignes dans allRows
  const allRowsIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    allRows.forEach((row, index) => {
      // Créer une clé unique basée sur les propriétés qui identifient une ligne
      const key = `${row.Source}|${row.rowIndex ?? ''}|${row.Date}|${row.Libellé}`;
      map.set(key, index);
    });
    return map;
  }, [allRows]);

  // Calculer les suggestions de catégories pour les lignes sans catégorie (optimisé)
  // Note: Les suggestions seront calculées de manière lazy dans CsvEditorTable
  // pour ne calculer que les lignes visibles
  const suggestionsMap = useMemo(() => {
    // Retourner un objet vide par défaut - les suggestions seront calculées à la demande
    // dans CsvEditorTable pour les lignes visibles uniquement
    return {};
  }, []);

  // Refs pour éviter les dépendances instables
  const allRowsRef = useRef<EditionRow[]>(allRows);
  const autoCategorisationStatsRef = useRef<WordStatsMap>(autoCategorisationStats);
  
  useEffect(() => {
    allRowsRef.current = allRows;
  }, [allRows]);
  
  useEffect(() => {
    autoCategorisationStatsRef.current = autoCategorisationStats;
  }, [autoCategorisationStats]);

  const handleRowsChange = useCallback(async (newRows: EditionRow[]) => {
    // Mettre à jour les lignes dans allRows en utilisant la Map d'indexation
    const currentAllRows = [...allRowsRef.current];
    const currentIndexMap = new Map<string, number>();
    
    // Reconstruire la map pour les lignes actuelles
    currentAllRows.forEach((row, index) => {
      const key = `${row.Source}|${row.rowIndex ?? ''}|${row.Date}|${row.Libellé}`;
      currentIndexMap.set(key, index);
    });
    
    let statsUpdated = false;
    let updatedStats = { ...autoCategorisationStatsRef.current };
    
    newRows.forEach((modifiedRow) => {
      // Utiliser la Map pour accès O(1) au lieu de findIndex O(n)
      const key = `${modifiedRow.Source}|${modifiedRow.rowIndex ?? ''}|${modifiedRow.Date}|${modifiedRow.Libellé}`;
      const allRowIndex = currentIndexMap.get(key);
      
      if (allRowIndex !== undefined && allRowIndex >= 0) {
        const oldRow = currentAllRows[allRowIndex];
        const newCategory = modifiedRow.catégorie || '';
        const oldCategory = oldRow.catégorie || '';
        
        // Si la catégorie a changé et n'est pas vide, mettre à jour les stats
        if (newCategory !== oldCategory && newCategory.trim() !== '' && modifiedRow.Libellé) {
          updatedStats = AutoCategorisationService.updateStatsForLabel(
            modifiedRow.Libellé,
            newCategory,
            updatedStats
          );
          statsUpdated = true;
        }
        
        currentAllRows[allRowIndex] = { ...modifiedRow };
      }
    });
    
    setAllRows(currentAllRows);
    
    // Sauvegarder les stats si elles ont été mises à jour
    if (statsUpdated) {
      try {
        await ConfigService.saveAutoCategorisationStats(updatedStats);
        setAutoCategorisationStats(updatedStats);
      } catch (error) {
        console.error('Erreur lors de la sauvegarde des stats d\'auto-catégorisation:', error);
      }
    }
  }, []);

  const handleRowInsert = useCallback((targetRowIndex: number, position: 'above' | 'below') => {
    if (targetRowIndex < 0 || targetRowIndex >= sortedRows.length) return;
    
    const targetRow = sortedRows[targetRowIndex];
    const newRow: EditionRow = {
      Source: targetRow.Source,
      Compte: targetRow.Compte,
      Date: '',
      'Date de valeur': '',
      Débit: 0,
      Crédit: 0,
      Libellé: '',
      Solde: targetRow.Solde || 0,
      catégorie: '',
      modified: true,
      deleted: false,
    };
    
    // Utiliser la Map d'indexation pour accès O(1)
    const key = `${targetRow.Source}|${targetRow.rowIndex ?? ''}|${targetRow.Date}|${targetRow.Libellé}`;
    const allRowIndex = allRowsIndexMap.get(key);
    
    if (allRowIndex !== undefined && allRowIndex >= 0) {
      const insertIndex = position === 'above' ? allRowIndex : allRowIndex + 1;
      const newAllRows = [...allRows];
      newAllRows.splice(insertIndex, 0, newRow);
      setAllRows(newAllRows);
    }
  }, [sortedRows, allRowsIndexMap, allRows]);

  const handleRowDelete = useCallback((rowIndex: number) => {
    if (rowIndex < 0 || rowIndex >= sortedRows.length) return;
    
    const targetRow = sortedRows[rowIndex];
    // Utiliser la Map d'indexation pour accès O(1)
    const key = `${targetRow.Source}|${targetRow.rowIndex ?? ''}|${targetRow.Date}|${targetRow.Libellé}`;
    const allRowIndex = allRowsIndexMap.get(key);
    
    if (allRowIndex !== undefined && allRowIndex >= 0) {
      const newAllRows = [...allRows];
      newAllRows[allRowIndex] = {
        ...newAllRows[allRowIndex],
        deleted: true,
        modified: true,
      };
      setAllRows(newAllRows);
    }
  }, [sortedRows, allRowsIndexMap, allRows]);

  const handleSort = useCallback((column: string, direction: 'asc' | 'desc' | null) => {
    startTransition(() => {
      setSortColumn(direction ? column : null);
      setSortDirection(direction);
    });
  }, []);

  const handleSave = useCallback(async () => {
    console.log('[Edition] Début de la sauvegarde...');
    
    // IMPORTANT: Réinitialiser l'état d'édition AVANT de commencer la sauvegarde
    // Cette fonction va détecter l'élément actif, appliquer sa modification, puis forcer le blur
    // false = ne pas effacer les modifications, seulement réinitialiser l'état d'édition
    csvTableRef.current?.clearModifications(false);
    console.log('[Edition] État d\'édition réinitialisé');
    
    // Attendre que le blur soit traité et que les modifications soient appliquées
    // Utiliser plusieurs ticks pour s'assurer que tout est bien traité
    await new Promise(resolve => setTimeout(resolve, 50));
    
    setSaving(true);
    let saveSuccess = false;
    let saveError: Error | null = null;
    try {
      // Récupérer les modifications locales depuis CsvEditorTable
      const modifiedRows = csvTableRef.current?.getModifiedRows() || [];
      console.log('[Edition] Modifications détectées:', modifiedRows.length, 'lignes');
      
      // Toujours créer updatedRows pour avoir les données à jour
      let updatedRows: EditionRow[] = [...allRows];
      
      if (modifiedRows.length === 0) {
        // Vérifier aussi les lignes déjà modifiées dans allRows (pour compatibilité)
        const rowsToSave = allRows.filter(row => row.modified || row.deleted);
        if (rowsToSave.length === 0) {
          toast.info(t('edition.noChanges'));
          console.log('[Edition] Aucune modification à sauvegarder - le finally s\'occupera de setSaving(false)');
          // Note: setSaving(false) sera appelé dans le finally, pas besoin de l'appeler ici
          return;
        }
        // updatedRows contient déjà les lignes modifiées
      } else {
        // Appliquer toutes les modifications locales à allRows en une seule fois
        const currentIndexMap = new Map<string, number>();
        
        // Reconstruire la map pour les lignes actuelles
        updatedRows.forEach((row, index) => {
          const key = `${row.Source}|${row.rowIndex ?? ''}|${row.Date}|${row.Libellé}`;
          currentIndexMap.set(key, index);
        });
        
        let statsUpdated = false;
        let updatedStats = { ...autoCategorisationStats };
        
        // Appliquer toutes les modifications
        modifiedRows.forEach((modifiedRow) => {
          const key = `${modifiedRow.Source}|${modifiedRow.rowIndex ?? ''}|${modifiedRow.Date}|${modifiedRow.Libellé}`;
          const allRowIndex = currentIndexMap.get(key);
          
          if (allRowIndex !== undefined && allRowIndex >= 0) {
            const oldRow = updatedRows[allRowIndex];
            const newCategory = modifiedRow.catégorie || '';
            const oldCategory = oldRow.catégorie || '';
            
            // Si la catégorie a changé et n'est pas vide, mettre à jour les stats
            if (newCategory !== oldCategory && newCategory.trim() !== '' && modifiedRow.Libellé) {
              updatedStats = AutoCategorisationService.updateStatsForLabel(
                modifiedRow.Libellé,
                newCategory,
                updatedStats
              );
              statsUpdated = true;
            }
            
            updatedRows[allRowIndex] = { ...modifiedRow };
          }
        });
        
        // Sauvegarder les stats si elles ont été mises à jour
        if (statsUpdated) {
          try {
            await ConfigService.saveAutoCategorisationStats(updatedStats);
            setAutoCategorisationStats(updatedStats);
          } catch (error) {
            console.error('Erreur lors de la sauvegarde des stats d\'auto-catégorisation:', error);
          }
        }
        
        // Note: clearModifications() a déjà été appelé au début de handleSave
      }
      
      // Mettre à jour l'état avec les lignes modifiées
      setAllRows(updatedRows);
      
      // Sauvegarder toutes les lignes (le service gère le regroupement par fichier)
      // IMPORTANT: Utiliser updatedRows au lieu de allRows pour sauvegarder les modifications
      console.log('[Edition] Appel de EditionService.saveEditionData...');
      await EditionService.saveEditionData(updatedRows);
      console.log('[Edition] Écriture des fichiers terminée');
      console.log('[Edition] Sauvegarde terminée avec succès');
      saveSuccess = true;
      
      // Pas besoin de recharger les données : elles sont déjà à jour dans allRows via setAllRows(updatedRows)
    } catch (error: any) {
      console.error('[Edition] Erreur lors de la sauvegarde:', error);
      saveError = error;
    } finally {
      console.log('[Edition] Fin de la fonction handleSave, réinitialisation de l\'état saving');
      setSaving(false);
      console.log('[Edition] État saving réinitialisé à false');
      
      // Afficher la notification (non-bloquant, ne perturbe pas le focus)
      if (saveSuccess) {
        toast.success(t('edition.saveSuccess'));
      } else if (saveError) {
        toast.error(t('edition.saveError', { error: saveError.message }));
      }
    }
  }, [allRows, autoCategorisationStats, t]);

  const handleOpenCleanDuplicates = useCallback(async () => {
    setShowCleanDuplicatesModal(true);
    setLoadingDuplicates(true);
    try {
      const { duplicates, inconsistenciesCount } = await EditionService.getDuplicatesPreview();
      setCleanDuplicatesPreview({ duplicates, inconsistenciesCount });
    } catch (error: any) {
      console.error('Erreur lors de la recherche des doublons:', error);
      toast.error(t('edition.cleanError', { error: error.message }));
      setShowCleanDuplicatesModal(false);
    } finally {
      setLoadingDuplicates(false);
    }
  }, [t]);

  const handleConfirmCleanDuplicates = useCallback(
    async (selectedIds: string[]) => {
      if (selectedIds.length === 0) {
        setShowCleanDuplicatesModal(false);
        return;
      }
      try {
        setIsDataLoading(true);
        const result = await EditionService.removeSelectedDuplicates(selectedIds);
        toast.success(t('edition.cleanSuccess', { cleaned: result.removed, fixed: result.inconsistenciesFixed, files: result.filesProcessed }));
        setShowCleanDuplicatesModal(false);
        setCleanDuplicatesPreview({ duplicates: [], inconsistenciesCount: 0 });
        await loadData();
      } catch (error: any) {
        console.error('Erreur lors du nettoyage:', error);
        toast.error(t('edition.cleanError', { error: error.message }));
      } finally {
        setIsDataLoading(false);
      }
    },
    [t]
  );

  const handleAutoCategorize = useCallback(async () => {
    try {
      setIsDataLoading(true);
      
      // Parcourir les lignes actuellement visibles (filtrées) sans catégorie
      const uncategorizedRows = sortedRows.filter(row => {
        const category = row.catégorie || '';
        const isEmpty = !category || category.trim() === '' || category === '???';
        return isEmpty && row.Libellé;
      });

      if (uncategorizedRows.length === 0) {
        toast.info(t('edition.autoCategorizeNoRows'));
        setIsDataLoading(false);
        return;
      }

      // Construire les suggestions pour chaque ligne
      const suggestions: PendingAutoCategorisation[] = [];
      
      uncategorizedRows.forEach((row) => {
        const suggestion = AutoCategorisationService.suggestBestCategory(
          row.Libellé,
          autoCategorisationStats
        );
        
        if (suggestion.category) {
          // Trouver l'index réel dans sortedRows
          const realIndex = sortedRows.findIndex(r => 
            r.Source === row.Source &&
            r.rowIndex === row.rowIndex &&
            r.Date === row.Date &&
            r.Libellé === row.Libellé
          );
          
          suggestions.push({
            rowIndex: realIndex,
            source: row.Source,
            date: row.Date,
            libelle: row.Libellé,
            currentCategory: row.catégorie || '',
            suggestedCategory: suggestion.category,
            confidence: suggestion.confidence,
            selected: true, // Par défaut, toutes les suggestions sont sélectionnées
          });
        }
      });

      if (suggestions.length === 0) {
        toast.info(t('edition.autoCategorizeNoSuggestions'));
        setIsDataLoading(false);
        return;
      }

      // Stocker les suggestions et ouvrir la modale
      setPendingAutoCategorisation(suggestions);
      setShowReviewModal(true);
    } catch (error: any) {
      console.error('Erreur lors de l\'auto-catégorisation:', error);
      toast.error(t('edition.autoCategorizeError', { error: error.message }));
    } finally {
      setIsDataLoading(false);
    }
  }, [sortedRows, autoCategorisationStats, t]);

  const handleConfirmAutoCategorisation = useCallback(async (selectedSuggestions: PendingAutoCategorisation[]) => {
    try {
      setIsDataLoading(true);
      const currentAllRows = [...allRowsRef.current];
      let statsUpdated = false;
      let updatedStats = { ...autoCategorisationStatsRef.current };
      let categorizedCount = 0;

      // Appliquer les catégories sélectionnées
      // Note: On garde findIndex ici car cette fonction est appelée moins fréquemment
      // et les suggestions sont généralement en petit nombre
      for (const suggestion of selectedSuggestions) {
        if (!suggestion.selected) continue;

        const rowIndex = currentAllRows.findIndex(r => 
          r.Source === suggestion.source &&
          r.Date === suggestion.date &&
          r.Libellé === suggestion.libelle
        );

        if (rowIndex >= 0 && suggestion.suggestedCategory) {
          currentAllRows[rowIndex] = {
            ...currentAllRows[rowIndex],
            catégorie: suggestion.suggestedCategory,
            modified: true,
          };
          categorizedCount++;

          // Mettre à jour les stats
          updatedStats = AutoCategorisationService.updateStatsForLabel(
            suggestion.libelle,
            suggestion.suggestedCategory,
            updatedStats
          );
          statsUpdated = true;
        }
      }

      setAllRows(currentAllRows);
      
      // Sauvegarder les stats si elles ont été mises à jour
      if (statsUpdated) {
        await ConfigService.saveAutoCategorisationStats(updatedStats);
        setAutoCategorisationStats(updatedStats);
      }
      
      // Fermer la modale
      setShowReviewModal(false);
      setPendingAutoCategorisation([]);
      
      toast.success(t('edition.autoCategorizeSuccess', { count: categorizedCount }));
    } catch (error: any) {
      console.error('Erreur lors de la validation de l\'auto-catégorisation:', error);
      toast.error(t('edition.autoCategorizeConfirmError', { error: error.message }));
    } finally {
      setIsDataLoading(false);
    }
  }, [t]);


  if (isLoading) {
    return <Loading message={t('edition.loading')} />;
  }

  // Détecter l'absence de données (après le chargement initial)
  const hasNoData = allRows.length === 0;
  const hasIgnoredFiles = ignoredFiles.length > 0;

  // Afficher EmptyState si aucune donnée n'est disponible ET qu'il n'y a pas de fichiers ignorés
  // Si des fichiers ont été ignorés, on affiche le message d'avertissement dans le contenu principal
  if (hasNoData && !hasIgnoredFiles) {
    return (
      <div className={`editor-container ${isDataLoading ? 'loading' : ''}`}>
        <EmptyState
          title={t('edition.noDataTitle', 'Aucune donnée disponible')}
          message={t('edition.noDataMessage', 'Importez des fichiers CSV pour commencer à éditer vos transactions')}
          actionLabel={t('edition.importData', 'Importer des données')}
        />
      </div>
    );
  }

  return (
    <div className={`editor-container ${isDataLoading ? 'loading' : ''}`}>
      {/* Sidebar avec filtres */}
      <aside className={`editor-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          {!isSidebarCollapsed && <h3>{t('edition.options')}</h3>}
          <button
            className="sidebar-collapse-button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? t('edition.expandSidebar', 'Afficher les filtres') : t('edition.collapseSidebar', 'Masquer les filtres')}
          >
            <FontAwesomeIcon icon={isSidebarCollapsed ? faChevronRight : faChevronLeft} />
          </button>
        </div>
        
        {!isSidebarCollapsed && (
          <>
            {/* Boutons d'action */}
            <div className="action-buttons">
          <button
            onClick={handleSave}
            className="action-button"
            disabled={saving}
          >
            <span className={saving ? 'spinning-icon' : ''}>
              <FontAwesomeIcon 
                icon={saving ? faCircleNotch : faSave}
              />
            </span>
            <span>{saving ? t('edition.saving') : t('edition.save')}</span>
          </button>
          <button
            onClick={handleAutoCategorize}
            className="action-button"
          >
            <FontAwesomeIcon icon={faMagic} />
            <span>{t('edition.autoCategorize')}</span>
          </button>
          <button
            onClick={handleOpenCleanDuplicates}
            className="action-button"
            disabled={isDataLoading}
            title={t('edition.cleanFilesTooltip')}
          >
            <FontAwesomeIcon icon={faBroom} />
            <span>{t('edition.cleanFiles')}</span>
          </button>
        </div>

        {/* Navigation des filtres */}
        <div className="filters-container">
          <div className="filter-nav">
            <button
              className={`filter-nav-button ${activeFilterTab === 'source' ? 'active' : ''}`}
              onClick={() => setActiveFilterTab('source')}
            >
              <FontAwesomeIcon icon={faFilter} />
              {t('edition.filtersBySource')}
            </button>
            <button
              className={`filter-nav-button ${activeFilterTab === 'category' ? 'active' : ''}`}
              onClick={() => setActiveFilterTab('category')}
            >
              <FontAwesomeIcon icon={faTags} />
              {t('edition.filtersByCategory')}
            </button>
            <button
              className={`filter-nav-button ${activeFilterTab === 'period' ? 'active' : ''}`}
              onClick={() => setActiveFilterTab('period')}
            >
              <FontAwesomeIcon icon={faCalendarAlt} />
              {t('edition.filtersByPeriod')}
            </button>
          </div>

          {/* Contenu des filtres */}
          <div className="filter-content-container">
            {/* Filtres par source */}
            <div className={`filter-content ${activeFilterTab === 'source' ? 'active' : ''}`}>
              <SourceFilterPanel
                rows={allRows}
                selectedSources={selectedSources}
                onSourcesChange={(sources) => {
                  startTransition(() => {
                    setSelectedSources(sources);
                  });
                }}
              />
            </div>

            {/* Filtres par catégorie */}
            <div className={`filter-content ${activeFilterTab === 'category' ? 'active' : ''}`}>
              <CategoryFilterPanel
                selectedCategories={selectedCategories}
                showUncategorized={showUncategorized}
                onCategoryFilterChange={(categories, showUncat) => {
                  startTransition(() => {
                    setSelectedCategories(categories);
                    setShowUncategorized(showUncat);
                  });
                }}
                categoriesRefreshKey={categoriesRefreshKey}
              />
            </div>

            {/* Filtres par période */}
            <div className={`filter-content ${activeFilterTab === 'period' ? 'active' : ''}`}>
              <PeriodFilterPanel
                startDate={startDate}
                endDate={endDate}
                onPeriodChange={(start, end) => {
                  startTransition(() => {
                    setStartDate(start);
                    setEndDate(end);
                  });
                }}
              />
            </div>
          </div>
        </div>
          </>
        )}
      </aside>

      {/* Contenu principal */}
      <main className="editor-main-content">
        {/* Barre de recherche */}
        <div className="search-container">
          <div className="flex items-center gap-2">
            <span>
              <FontAwesomeIcon icon={faSearch} />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('edition.searchPlaceholder')}
            />
          </div>
        </div>

        {/* Message d'avertissement pour les fichiers ignorés */}
        {ignoredFiles.length > 0 && (
          <div style={{
            margin: '1rem 0',
            padding: '1rem',
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '0.5rem',
            color: '#92400e',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem'
          }}>
            <FontAwesomeIcon icon={faExclamationTriangle} style={{ marginTop: '0.125rem', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 600, marginBottom: '0.5rem' }}>
                {t('edition.ignoredFilesTitle', 'Aucune source de données n\'a de compte correspondant')}
              </p>
              <p style={{ margin: 0, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                {t('edition.ignoredFilesMessage', 'Les fichiers suivants ont été ignorés car leur code de compte n\'existe pas dans la configuration :')}
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
                {ignoredFiles.map((file, index) => (
                  <li key={index}>
                    <strong>{file.fileName}</strong> ({t('edition.accountCode', 'Code compte')}: {file.accountCode})
                  </li>
                ))}
              </ul>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', fontStyle: 'italic' }}>
                {t('edition.ignoredFilesHint', 'Ajoutez ces comptes dans les paramètres pour pouvoir éditer ces fichiers.')}
              </p>
            </div>
          </div>
        )}

        {/* Conteneur flex pour tableau et légende */}
        <div className="table-legend-container">
          {/* Tableau */}
          <div className="table-wrapper">
            {sortedRows.length === 0 ? (
              // Vérifier si c'est le cas spécial : toutes les transactions sont catégorisées
              showUncategorized && selectedCategories.length === 0 ? (
                <div className="empty-state-message success-message" style={{
                  padding: '3rem',
                  textAlign: 'center',
                  color: '#10b981',
                  fontSize: '1.1rem'
                }}>
                  <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: '3rem', marginBottom: '1rem' }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {t('edition.allCategorized')}
                  </p>
                </div>
              ) : hasIgnoredFiles ? (
                <div className="empty-state-message" style={{
                  padding: '3rem',
                  textAlign: 'center',
                  color: 'var(--text-secondary, #6b7280)',
                  fontSize: '1.1rem'
                }}>
                  <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: '3rem', marginBottom: '1rem', color: '#f59e0b' }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {t('edition.noDataDueToIgnoredFiles', 'Aucune donnée disponible')}
                  </p>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>
                    {t('edition.noDataDueToIgnoredFilesHint', 'Tous les fichiers ont été ignorés car leurs codes de compte n\'existent pas dans la configuration. Consultez le message ci-dessus pour plus de détails.')}
                  </p>
                </div>
              ) : (
                <div className="empty-state-message" style={{
                  padding: '3rem',
                  textAlign: 'center',
                  color: 'var(--text-secondary, #6b7280)',
                  fontSize: '1.1rem'
                }}>
                  <p style={{ margin: 0 }}>
                    {t('edition.noData')}
                  </p>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>
                    {t('edition.noDataHint')}
                  </p>
                </div>
              )
            ) : (
              <CsvEditorTable
                ref={csvTableRef}
                headers={headers}
                rows={sortedRows}
                onRowsChange={handleRowsChange}
                onRowInsert={handleRowInsert}
                onRowDelete={handleRowDelete}
                onSort={handleSort}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                categorySuggestions={suggestionsMap}
                categoriesRefreshKey={categoriesRefreshKey}
              />
            )}
          </div>

          {/* Panneau de légende des catégories */}
          <CategoryLegendPanel
            isCollapsed={isLegendCollapsed}
            onToggleCollapse={() => setIsLegendCollapsed(!isLegendCollapsed)}
            onCategoriesChange={() => setCategoriesRefreshKey(k => k + 1)}
          />
        </div>

        {/* Info sur le nombre de lignes */}
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400 text-center">
          {t('edition.displayingRows', { displayed: sortedRows.length, total: allRows.length })}
        </div>
      </main>

      {/* Modale de révision des auto-catégorisations */}
      <AutoCategorisationReviewModal
        isOpen={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          setPendingAutoCategorisation([]);
        }}
        suggestions={pendingAutoCategorisation}
        onConfirm={handleConfirmAutoCategorisation}
      />

      <CleanDuplicatesModal
        isOpen={showCleanDuplicatesModal}
        onClose={() => {
          setShowCleanDuplicatesModal(false);
          setCleanDuplicatesPreview({ duplicates: [], inconsistenciesCount: 0 });
        }}
        duplicates={cleanDuplicatesPreview.duplicates}
        inconsistenciesCount={cleanDuplicatesPreview.inconsistenciesCount}
        isLoading={loadingDuplicates}
        onConfirm={handleConfirmCleanDuplicates}
      />
    </div>
  );
};

export default Edition;
