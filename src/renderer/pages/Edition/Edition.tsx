import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faMagic, faTags, faFilter, faSearch, faCheckCircle, faTrashAlt } from '@fortawesome/free-solid-svg-icons';
import { Loading, EmptyState } from '../../components/Common';
import SourceFilterPanel from '../../components/Edition/SourceFilterPanel';
import CategoryFilterPanel from '../../components/Edition/CategoryFilterPanel';
import CsvEditorTable, { CsvEditorTableRef } from '../../components/Edition/CsvEditorTable';
import AutoCategorisationReviewModal from '../../components/Edition/AutoCategorisationReviewModal';
import CategoryLegendPanel from '../../components/Edition/CategoryLegendPanel';
import { EditionService } from '../../services/EditionService';
import { ConfigService } from '../../services/ConfigService';
import { AutoCategorisationService } from '../../services/AutoCategorisationService';
import { EditionRow } from '../../types/Edition';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [activeFilterTab, setActiveFilterTab] = useState<'source' | 'category'>('source');
  const [saving, setSaving] = useState(false);
  const [autoCategorisationStats, setAutoCategorisationStats] = useState<WordStatsMap>({});
  const [pendingAutoCategorisation, setPendingAutoCategorisation] = useState<PendingAutoCategorisation[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);
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
      // Filtrer les colonnes "Solde initial" et "Index" pour ne pas les afficher
      const filteredHeaders = data.headers.filter(
        header => header !== 'Solde initial' && header !== 'Index'
      );
      setHeaders(filteredHeaders);
      setAllRows(data.rows);
      
      // Initialiser les sources sélectionnées avec toutes les sources uniques
      const uniqueSources = [...new Set(data.rows.map(row => row.Source))];
      setSelectedSources(uniqueSources);
      
      // Réinitialiser les modifications locales après le chargement
      csvTableRef.current?.clearModifications();
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      alert('Erreur lors du chargement des données. Vérifiez la console pour plus de détails.');
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

  // Filtrer les lignes selon les sources sélectionnées
  const filteredBySource = useMemo(() => {
    if (selectedSources.length === 0) return [];
    return allRows.filter(row => selectedSources.includes(row.Source));
  }, [allRows, selectedSources]);

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
      
      return selectedCategories.includes(category);
    });
  }, [filteredBySource, selectedCategories, showUncategorized]);

  // Filtrer par recherche textuelle
  const filteredBySearch = useMemo(() => {
    if (!searchTerm.trim()) return filteredByCategory;
    
    const term = searchTerm.toLowerCase();
    return filteredByCategory.filter(row => {
      return Object.values(row).some(value => {
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(term);
      });
    });
  }, [filteredByCategory, searchTerm]);

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
  const suggestionsMap = useMemo(() => {
    const suggestions: Record<number, string | null> = {};
    
    sortedRows.forEach((row, index) => {
      const category = row.catégorie || '';
      const isEmpty = !category || category.trim() === '' || category === '???';
      
      // Ne calculer les suggestions que pour les lignes sans catégorie avec un libellé
      if (isEmpty && row.Libellé) {
        const suggestion = AutoCategorisationService.suggestBestCategory(
          row.Libellé,
          autoCategorisationStats
        );
        if (suggestion.category) {
          suggestions[index] = suggestion.category;
        }
      }
    });
    
    return suggestions;
  }, [sortedRows, autoCategorisationStats]);

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
    setSortColumn(direction ? column : null);
    setSortDirection(direction);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setIsDataLoading(true);
    try {
      // Récupérer les modifications locales depuis CsvEditorTable
      const modifiedRows = csvTableRef.current?.getModifiedRows() || [];
      
      if (modifiedRows.length === 0) {
        // Vérifier aussi les lignes déjà modifiées dans allRows (pour compatibilité)
        const rowsToSave = allRows.filter(row => row.modified || row.deleted);
        if (rowsToSave.length === 0) {
          alert(t('edition.noChanges'));
          return;
        }
      } else {
        // Appliquer toutes les modifications locales à allRows en une seule fois
        const updatedRows = [...allRows];
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
        
        setAllRows(updatedRows);
        
        // Sauvegarder les stats si elles ont été mises à jour
        if (statsUpdated) {
          try {
            await ConfigService.saveAutoCategorisationStats(updatedStats);
            setAutoCategorisationStats(updatedStats);
          } catch (error) {
            console.error('Erreur lors de la sauvegarde des stats d\'auto-catégorisation:', error);
          }
        }
        
        // Nettoyer les modifications locales
        csvTableRef.current?.clearModifications();
      }
      
      // Sauvegarder toutes les lignes (le service gère le regroupement par fichier)
      await EditionService.saveEditionData(allRows);
      
      alert(t('edition.saveSuccess'));
      
      // Recharger les données
      await loadData();
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert(t('edition.saveError', { error: error.message }));
    } finally {
      setSaving(false);
      setIsDataLoading(false);
    }
  }, [allRows, autoCategorisationStats, t]);

  const handleCleanDuplicates = useCallback(async () => {
    if (!window.confirm(t('edition.cleanConfirm'))) {
      return;
    }
    
    try {
      setIsDataLoading(true);
      const result = await EditionService.cleanDuplicateCSVFiles();
      alert(t('edition.cleanSuccess', { cleaned: result.cleaned, fixed: result.inconsistenciesFixed, files: result.filesProcessed }));
      await loadData(); // Recharger les données
    } catch (error: any) {
      console.error('Erreur lors du nettoyage:', error);
      alert(t('edition.cleanError', { error: error.message }));
    } finally {
      setIsDataLoading(false);
    }
  }, [t]);

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
        alert(t('edition.autoCategorizeNoRows'));
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
        alert(t('edition.autoCategorizeNoSuggestions'));
        setIsDataLoading(false);
        return;
      }

      // Stocker les suggestions et ouvrir la modale
      setPendingAutoCategorisation(suggestions);
      setShowReviewModal(true);
    } catch (error: any) {
      console.error('Erreur lors de l\'auto-catégorisation:', error);
      alert(t('edition.autoCategorizeError', { error: error.message }));
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
      
      alert(t('edition.autoCategorizeSuccess', { count: categorizedCount }));
    } catch (error: any) {
      console.error('Erreur lors de la validation de l\'auto-catégorisation:', error);
      alert(t('edition.autoCategorizeConfirmError', { error: error.message }));
    } finally {
      setIsDataLoading(false);
    }
  }, [t]);


  if (isLoading) {
    return <Loading message={t('edition.loading')} />;
  }

  // Détecter l'absence de données (après le chargement initial)
  const hasNoData = allRows.length === 0;

  // Afficher EmptyState si aucune donnée n'est disponible
  if (hasNoData) {
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
      <aside className="editor-sidebar">
        <h3>{t('edition.options')}</h3>
        
        {/* Boutons d'action */}
        <div className="action-buttons">
          <button
            onClick={handleSave}
            className="action-button"
            disabled={saving}
          >
            <FontAwesomeIcon icon={faSave} />
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
            onClick={handleCleanDuplicates}
            className="action-button"
            disabled={isDataLoading}
          >
            <FontAwesomeIcon icon={faTrashAlt} />
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
          </div>

          {/* Contenu des filtres */}
          <div className="filter-content-container">
            {/* Filtres par source */}
            <div className={`filter-content ${activeFilterTab === 'source' ? 'active' : ''}`}>
              <SourceFilterPanel
                rows={allRows}
                selectedSources={selectedSources}
                onSourcesChange={setSelectedSources}
              />
            </div>

            {/* Filtres par catégorie */}
            <div className={`filter-content ${activeFilterTab === 'category' ? 'active' : ''}`}>
              <CategoryFilterPanel
                selectedCategories={selectedCategories}
                showUncategorized={showUncategorized}
                onCategoryFilterChange={(categories, showUncat) => {
                  setSelectedCategories(categories);
                  setShowUncategorized(showUncat);
                }}
              />
            </div>
          </div>
        </div>
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
              />
            )}
          </div>

          {/* Panneau de légende des catégories */}
          <CategoryLegendPanel
            isCollapsed={isLegendCollapsed}
            onToggleCollapse={() => setIsLegendCollapsed(!isLegendCollapsed)}
            onCategoriesChange={() => {
              // Recharger les catégories dans CategoryFilterPanel si nécessaire
              // Le composant se mettra à jour automatiquement via ConfigService
            }}
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
    </div>
  );
};

export default Edition;
