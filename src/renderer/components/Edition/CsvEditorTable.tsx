import React, { useState, useEffect, useRef, useCallback, memo, useImperativeHandle, forwardRef, startTransition, useMemo, useDeferredValue } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort, faSortUp, faSortDown, faTrashAlt, faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons';
import { EditionRow } from '../../types/Edition';
import { ConfigService } from '../../services/ConfigService';
import { AutoCategorisationService } from '../../services/AutoCategorisationService';

interface CsvEditorTableProps {
  headers: string[];
  rows: EditionRow[];
  onRowsChange: (rows: EditionRow[]) => void;
  onRowInsert?: (targetRowIndex: number, position: 'above' | 'below') => void;
  onRowDelete?: (rowIndex: number) => void;
  onSort?: (column: string, direction: 'asc' | 'desc' | null) => void;
  sortColumn?: string | null;
  sortDirection?: 'asc' | 'desc' | null;
  categorySuggestions?: Record<number, string | null>; // Suggestions de catégories par index de ligne
}

export interface CsvEditorTableRef {
  getModifiedRows: () => EditionRow[];
  clearModifications: () => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetRowIndex: number;
}

// Fonction pour formater la valeur d'une cellule pour l'affichage (mémorisée)
const formatCellValue = (value: any, header: string): string => {
  if (value === null || value === undefined) return '';
  if (header === 'Débit' || header === 'Crédit' || header === 'Solde') {
    const num = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
    return num === 0 ? '0' : num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(value);
};

// Interface pour TableCell
interface TableCellProps {
  rowIndex: number;
  colIndex: number;
  header: string;
  displayValue: string;
  columnWidth: number;
  isEditing: boolean;
  editingValue: string;
  categorySuggestion: string | null | undefined;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onCellFocus: (rowIndex: number, colIndex: number) => void;
  onCellBlur: () => void;
  onKeyDown: (event: React.KeyboardEvent, rowIndex: number, colIndex: number) => void;
}

// Composant TableCell mémorisé
const TableCell = memo<TableCellProps>(({
  rowIndex,
  colIndex,
  header,
  displayValue,
  columnWidth,
  isEditing,
  editingValue,
  categorySuggestion,
  onCellChange,
  onCellFocus,
  onCellBlur,
  onKeyDown,
}) => {
  const isLibelle = header === 'Libellé';
  const isCategory = header === 'catégorie';
  const hasSuggestion = isCategory && categorySuggestion && (!displayValue || displayValue.trim() === '' || displayValue === '???');

  if (isLibelle) {
    return (
      <td style={{ width: columnWidth || 'auto' }}>
        <div className="label-cell-content">
          <textarea
            value={isEditing ? editingValue : displayValue}
            onChange={(e) => onCellChange(rowIndex, colIndex, e.target.value)}
            onFocus={() => onCellFocus(rowIndex, colIndex)}
            onBlur={onCellBlur}
            onKeyDown={(e) => onKeyDown(e, rowIndex, colIndex)}
            className="form-control form-control-sm libelle-textarea"
            rows={1}
          />
        </div>
      </td>
    );
  }

  return (
    <td style={{ width: columnWidth || 'auto' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={isEditing ? editingValue : displayValue}
          onChange={(e) => onCellChange(rowIndex, colIndex, e.target.value)}
          onFocus={() => onCellFocus(rowIndex, colIndex)}
          onBlur={onCellBlur}
          onKeyDown={(e) => onKeyDown(e, rowIndex, colIndex)}
          className="form-control form-control-sm"
          style={{
            textAlign: header === 'Débit' || header === 'Crédit' || header === 'Solde' ? 'right' : 'left',
            ...(isCategory && displayValue === 'X' ? { backgroundColor: '#fee2e2', cursor: 'not-allowed' } : {}),
          }}
          disabled={isCategory && displayValue === 'X'}
          placeholder={hasSuggestion ? `Suggéré: ${categorySuggestion}` : undefined}
          maxLength={isCategory ? 1 : undefined}
        />
        {hasSuggestion && !isEditing && (
          <span className="suggestion-badge">
            <span>💡</span>
            <span>{categorySuggestion}</span>
          </span>
        )}
      </div>
    </td>
  );
}, (prevProps, nextProps) => {
  // Comparaison personnalisée pour optimiser les re-renders
  return (
    prevProps.rowIndex === nextProps.rowIndex &&
    prevProps.colIndex === nextProps.colIndex &&
    prevProps.displayValue === nextProps.displayValue &&
    prevProps.columnWidth === nextProps.columnWidth &&
    prevProps.isEditing === nextProps.isEditing &&
    prevProps.editingValue === nextProps.editingValue &&
    prevProps.categorySuggestion === nextProps.categorySuggestion &&
    prevProps.header === nextProps.header
  );
});

TableCell.displayName = 'TableCell';

// Interface pour TableRow
interface TableRowProps {
  row: EditionRow;
  rowIndex: number;
  headers: string[];
  columnWidths: number[];
  editingCell: { rowIndex: number; colIndex: number } | null;
  editingValue: string;
  categorySuggestion: string | null | undefined;
  onContextMenu: (event: React.MouseEvent, rowIndex: number) => void;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onCellFocus: (rowIndex: number, colIndex: number) => void;
  onCellBlur: () => void;
  onKeyDown: (event: React.KeyboardEvent, rowIndex: number, colIndex: number) => void;
  getRowWithModifications: (row: EditionRow) => EditionRow;
  modifiedRowKeys: Set<string>;
}

// Composant TableRow mémorisé
const TableRow = memo<TableRowProps>(({
  row,
  rowIndex,
  headers,
  columnWidths,
  editingCell,
  editingValue,
  categorySuggestion,
  onContextMenu,
  onCellChange,
  onCellFocus,
  onCellBlur,
  onKeyDown,
  getRowWithModifications,
  modifiedRowKeys,
}) => {
  const isEditingRow = editingCell?.rowIndex === rowIndex;
  // Utiliser la ligne avec modifications appliquées
  const rowWithModifications = getRowWithModifications(row);
  const rowKey = `${row.Source}|${row.rowIndex ?? ''}|${row.Date}|${row.Libellé}`;
  const isModified = modifiedRowKeys.has(rowKey) || rowWithModifications.modified;

  return (
    <tr
      className={`${isModified ? 'modified-row' : ''} ${rowWithModifications.deleted ? 'deleted-row' : ''}`}
      onContextMenu={(e) => onContextMenu(e, rowIndex)}
    >
      {headers.map((header, colIndex) => {
        const value = rowWithModifications[header as keyof EditionRow];
        const displayValue = formatCellValue(value, header);
        const isEditing = isEditingRow && editingCell?.colIndex === colIndex;

        return (
          <TableCell
            key={`${rowIndex}-${colIndex}`}
            rowIndex={rowIndex}
            colIndex={colIndex}
            header={header}
            displayValue={displayValue}
            columnWidth={columnWidths[colIndex] || 150}
            isEditing={isEditing}
            editingValue={editingValue}
            categorySuggestion={categorySuggestion}
            onCellChange={onCellChange}
            onCellFocus={onCellFocus}
            onCellBlur={onCellBlur}
            onKeyDown={onKeyDown}
          />
        );
      })}
    </tr>
  );
}, (prevProps, nextProps) => {
  // Comparaison simplifiée et optimisée pour les re-renders
  if (prevProps.rowIndex !== nextProps.rowIndex) return false;
  
  // Comparer les clés de modification
  const prevRowKey = `${prevProps.row.Source}|${prevProps.row.rowIndex ?? ''}|${prevProps.row.Date}|${prevProps.row.Libellé}`;
  const nextRowKey = `${nextProps.row.Source}|${nextProps.row.rowIndex ?? ''}|${nextProps.row.Date}|${nextProps.row.Libellé}`;
  const prevIsModified = prevProps.modifiedRowKeys.has(prevRowKey);
  const nextIsModified = nextProps.modifiedRowKeys.has(nextRowKey);
  
  if (prevIsModified !== nextIsModified) return false;
  
  // Comparer l'état d'édition
  const prevIsEditing = prevProps.editingCell?.rowIndex === prevProps.rowIndex;
  const nextIsEditing = nextProps.editingCell?.rowIndex === nextProps.rowIndex;
  if (prevIsEditing !== nextIsEditing) return false;
  
  // Si on édite cette ligne, vérifier les valeurs d'édition
  if (prevIsEditing && nextIsEditing) {
    if (prevProps.editingCell?.colIndex !== nextProps.editingCell?.colIndex) return false;
    if (prevProps.editingValue !== nextProps.editingValue) return false;
  }
  
  // Comparer la suggestion de catégorie
  if (prevProps.categorySuggestion !== nextProps.categorySuggestion) return false;
  
  // Comparer les références des objets (si la ligne n'a pas changé, la référence devrait être la même)
  if (prevProps.row !== nextProps.row) {
    // Si la référence a changé, vérifier les valeurs des colonnes importantes
    // pour détecter les changements de filtres/tri
    const importantFields: (keyof EditionRow)[] = ['Source', 'Date', 'Libellé', 'catégorie', 'Débit', 'Crédit', 'Solde', 'Compte'];
    for (const field of importantFields) {
      if (prevProps.row[field] !== nextProps.row[field]) {
        return false; // Les données ont changé, besoin de re-render
      }
    }
    
    // Vérifier les propriétés critiques
    if (prevProps.row.modified !== nextProps.row.modified) return false;
    if (prevProps.row.deleted !== nextProps.row.deleted) return false;
  }
  
  // Comparer les références des tableaux
  if (prevProps.headers !== nextProps.headers) return false;
  if (prevProps.columnWidths !== nextProps.columnWidths) return false;
  
  return true;
});

TableRow.displayName = 'TableRow';

const CsvEditorTable = forwardRef<CsvEditorTableRef, CsvEditorTableProps>(({
  headers,
  rows,
  onRowsChange,
  onRowInsert,
  onRowDelete,
  onSort,
  sortColumn,
  sortDirection,
  categorySuggestions: _categorySuggestions = {}, // Non utilisé, calculé à la demande maintenant
}, ref) => {
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [editingValue, setEditingValue] = useState<string>(''); // Valeur temporaire pendant l'édition
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const [resizingColumn, setResizingColumn] = useState<number | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const tableRef = useRef<HTMLTableElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [bankAccounts, setBankAccounts] = useState<Record<string, any>>({});

  // Charger les comptes bancaires pour la validation
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const accounts = await ConfigService.loadAccounts();
        setBankAccounts(accounts);
      } catch (error) {
        console.error('Erreur lors du chargement des comptes pour validation:', error);
      }
    };
    loadAccounts();
  }, []);

  /**
   * Extrait le préfixe du compte depuis le nom de fichier Source
   */
  const extractAccountPrefix = (source: string): string => {
    const match = source.match(/^([A-Za-z0-9]+)_/);
    return match ? match[1].trim().toUpperCase() : 'UNKNOWN';
  };

  // Initialiser les largeurs des colonnes
  useEffect(() => {
    if (headers.length > 0 && columnWidths.length === 0) {
      // Largeurs par défaut basées sur le type de colonne
      const defaultWidths = headers.map(header => {
        if (header === 'Libellé') return 300;
        if (header === 'Source') return 200;
        if (header === 'Date' || header === 'Date de valeur') return 120;
        if (header === 'Débit' || header === 'Crédit' || header === 'Solde') return 120;
        return 150;
      });
      setColumnWidths(defaultWidths);
    }
  }, [headers, columnWidths.length]);

  // Fermer le menu contextuel lors d'un clic ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [contextMenu]);

  // Gestion du redimensionnement des colonnes
  useEffect(() => {
    if (resizingColumn === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartX;
      const newWidth = Math.max(50, resizeStartWidth + diff); // Largeur minimale de 50px
      
      setColumnWidths(prev => {
        const newWidths = [...prev];
        newWidths[resizingColumn] = newWidth;
        return newWidths;
      });
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, resizeStartX, resizeStartWidth]);

  const handleResizeStart = (e: React.MouseEvent, colIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(colIndex);
    setResizeStartX(e.clientX);
    setResizeStartWidth(columnWidths[colIndex] || 150);
  };

  // Refs pour stocker les données et éviter les dépendances instables dans les callbacks
  const rowsRef = useRef<EditionRow[]>(rows);
  const headersRef = useRef<string[]>(headers);
  const bankAccountsRef = useRef<Record<string, any>>(bankAccounts);
  const onRowsChangeRef = useRef(onRowsChange);

  // Map pour stocker les modifications locales (clé unique -> EditionRow modifié)
  const localModificationsRef = useRef<Map<string, EditionRow>>(new Map());
  // Set pour stocker les clés des lignes modifiées (pour forcer le re-render)
  const [modifiedRowKeys, setModifiedRowKeys] = useState<Set<string>>(new Set());
  
  // Cache pour les suggestions de catégories (calculées à la demande pour les lignes visibles)
  const suggestionsCacheRef = useRef<Map<number, string | null>>(new Map());
  const autoCategorisationStatsRef = useRef<any>(null);
  
  // Charger les stats d'auto-catégorisation pour les suggestions
  useEffect(() => {
    const loadStats = async () => {
      try {
        const stats = await ConfigService.loadAutoCategorisationStats();
        autoCategorisationStatsRef.current = stats;
        // Vider le cache quand les stats changent
        suggestionsCacheRef.current.clear();
      } catch (error) {
        console.error('Erreur lors du chargement des stats pour suggestions:', error);
      }
    };
    loadStats();
  }, []);

  // Fonction pour générer une clé unique pour une ligne
  const getRowKey = useCallback((row: EditionRow): string => {
    return `${row.Source}|${row.rowIndex ?? ''}|${row.Date}|${row.Libellé}`;
  }, []);

  // Fonction pour obtenir une ligne avec ses modifications appliquées
  const getRowWithModifications = useCallback((row: EditionRow): EditionRow => {
    const key = getRowKey(row);
    const modifiedRow = localModificationsRef.current.get(key);
    if (modifiedRow) {
      return { ...row, ...modifiedRow };
    }
    return row;
  }, [getRowKey]);

  // Mettre à jour les refs quand les props changent
  useEffect(() => {
    rowsRef.current = rows;
    // Vider le cache des suggestions quand les lignes changent
    suggestionsCacheRef.current.clear();
  }, [rows]);
  
  useEffect(() => {
    headersRef.current = headers;
  }, [headers]);
  
  useEffect(() => {
    bankAccountsRef.current = bankAccounts;
  }, [bankAccounts]);
  
  useEffect(() => {
    onRowsChangeRef.current = onRowsChange;
  }, [onRowsChange]);

  // Exposer les méthodes via ref
  useImperativeHandle(ref, () => ({
    getModifiedRows: () => {
      const modifiedRows: EditionRow[] = [];
      localModificationsRef.current.forEach((modifiedRow) => {
        modifiedRows.push(modifiedRow);
      });
      return modifiedRows;
    },
    clearModifications: () => {
      localModificationsRef.current.clear();
      setModifiedRowKeys(new Set());
    },
  }), []);

  // Fonction pour mettre à jour uniquement la valeur temporaire pendant l'édition
  const handleCellChange = useCallback((_rowIndex: number, colIndex: number, value: string) => {
    const header = headersRef.current[colIndex];
    
    // Pour la colonne catégorie, limiter à 1 caractère et transformer en majuscule
    if (header === 'catégorie') {
      value = value.toUpperCase().slice(0, 1);
    }
    
    // Mettre à jour uniquement la valeur temporaire
    setEditingValue(value);
  }, []);

  // Fonction pour appliquer le changement après validation (stockage local uniquement)
  const applyCellChange = useCallback((rowIndex: number, colIndex: number, value: string) => {
    const currentRows = rowsRef.current;
    const header = headersRef.current[colIndex];
    const originalRow = currentRows[rowIndex];
    
    // VALIDATION : Empêcher la modification de la catégorie "X"
    if (header === 'catégorie' && originalRow.catégorie === 'X') {
      alert('La catégorie "X" ne peut pas être modifiée.');
      return false;
    }
    
    // VALIDATION : Pour la colonne catégorie, vérifier qu'il n'y a qu'un seul caractère
    if (header === 'catégorie') {
      const normalizedValue = value.trim().toUpperCase();
      if (normalizedValue.length > 1) {
        alert('Le code de catégorie doit être exactement un seul caractère');
        return false;
      }
      value = normalizedValue;
    }
    
    // VALIDATION : Empêcher la modification incohérente du champ Compte
    if (header === 'Compte' && originalRow.Source) {
      const prefix = extractAccountPrefix(originalRow.Source);
      const accountData = bankAccountsRef.current[prefix];
      const expectedAccountName = accountData
        ? (typeof accountData === 'object' && accountData !== null && 'name' in accountData
          ? accountData.name
          : String(accountData))
        : null;
      
      if (expectedAccountName && value !== expectedAccountName) {
        console.warn(
          `[CsvEditorTable] Tentative de modification incohérente du Compte: ` +
          `valeur="${value}" vs attendu="${expectedAccountName}" (préfixe: ${prefix})`
        );
        
        // Afficher un avertissement à l'utilisateur
        const confirmed = window.confirm(
          `Le compte "${value}" ne correspond pas au préfixe du fichier source "${originalRow.Source}" ` +
          `(préfixe attendu: ${prefix}).\n\n` +
          `Le compte attendu est "${expectedAccountName}".\n\n` +
          `Voulez-vous corriger automatiquement avec le compte attendu ?`
        );
        
        if (confirmed) {
          // Corriger automatiquement avec le compte attendu
          value = expectedAccountName;
          console.log(`[CsvEditorTable] Correction automatique: Compte="${value}"`);
        } else {
          // L'utilisateur veut garder sa modification, mais on log quand même
          console.warn(
            `[CsvEditorTable] L'utilisateur a choisi de garder le compte "${value}" ` +
            `malgré l'incohérence avec le Source "${originalRow.Source}"`
          );
        }
      }
    }
    
    // Obtenir la ligne actuelle (avec modifications précédentes si elles existent)
    const rowKey = getRowKey(originalRow);
    const existingModifiedRow = localModificationsRef.current.get(rowKey);
    const baseRow = existingModifiedRow || originalRow;
    
    // Créer la ligne modifiée
    let modifiedRow: EditionRow;
    
    if (header === 'Débit' || header === 'Crédit' || header === 'Solde') {
      // Normaliser les valeurs numériques
      const numValue = parseFloat(value.replace(',', '.').replace(/\s/g, '')) || 0;
      if (header === 'Débit') {
        modifiedRow = {
          ...baseRow,
          [header]: numValue !== 0 ? -Math.abs(numValue) : 0,
          modified: true,
        };
      } else if (header === 'Crédit') {
        modifiedRow = {
          ...baseRow,
          [header]: numValue !== 0 ? Math.abs(numValue) : 0,
          modified: true,
        };
      } else {
        modifiedRow = {
          ...baseRow,
          [header]: numValue,
          modified: true,
        };
      }
    } else {
      modifiedRow = {
        ...baseRow,
        [header]: value,
        modified: true,
      };
    }

    // Stocker la modification localement
    localModificationsRef.current.set(rowKey, modifiedRow);
    
    // Batch les mises à jour avec startTransition pour éviter les re-renders bloquants
    startTransition(() => {
      setModifiedRowKeys(prev => {
        const newSet = new Set(prev);
        newSet.add(rowKey);
        return newSet;
      });
    });
    
    // NE PLUS appeler onRowsChange - les modifications seront appliquées à la sauvegarde
    return true;
  }, [getRowKey]);

  const handleCellFocus = useCallback((rowIndex: number, colIndex: number) => {
    const header = headersRef.current[colIndex];
    const originalRow = rowsRef.current[rowIndex];
    const rowWithModifications = getRowWithModifications(originalRow);
    const currentValue = rowWithModifications[header as keyof EditionRow];
    const displayValue = formatCellValue(currentValue, header);
    setEditingCell({ rowIndex, colIndex });
    setEditingValue(String(displayValue));
  }, [getRowWithModifications]);

  const handleCellBlur = useCallback(() => {
    // Appliquer le changement avant de fermer l'édition
    if (editingCell) {
      applyCellChange(editingCell.rowIndex, editingCell.colIndex, editingValue);
    }
    // Délai pour permettre les clics sur le menu contextuel
    setTimeout(() => {
      setEditingCell(null);
      setEditingValue('');
    }, 200);
  }, [editingCell, editingValue, applyCellChange]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    const totalRows = rowsRef.current.length;
    const totalCols = headersRef.current.length;
    const input = event.target as HTMLInputElement | HTMLTextAreaElement;

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        // Appliquer le changement avant de se déplacer
        if (editingCell && editingCell.rowIndex === rowIndex && editingCell.colIndex === colIndex) {
          applyCellChange(rowIndex, colIndex, editingValue);
        }
        if (rowIndex > 0) {
          const targetCell = tableRef.current?.querySelector(
            `tbody tr:nth-child(${rowIndex}) td:nth-child(${colIndex + 1}) input, tbody tr:nth-child(${rowIndex}) td:nth-child(${colIndex + 1}) textarea`
          ) as HTMLInputElement | HTMLTextAreaElement;
          targetCell?.focus();
          targetCell?.select();
        }
        break;

      case 'ArrowDown':
        event.preventDefault();
        // Appliquer le changement avant de se déplacer
        if (editingCell && editingCell.rowIndex === rowIndex && editingCell.colIndex === colIndex) {
          applyCellChange(rowIndex, colIndex, editingValue);
        }
        if (rowIndex < totalRows - 1) {
          const targetCell = tableRef.current?.querySelector(
            `tbody tr:nth-child(${rowIndex + 2}) td:nth-child(${colIndex + 1}) input, tbody tr:nth-child(${rowIndex + 2}) td:nth-child(${colIndex + 1}) textarea`
          ) as HTMLInputElement | HTMLTextAreaElement;
          targetCell?.focus();
          targetCell?.select();
        }
        break;

      case 'ArrowLeft':
        if (event.ctrlKey || input.selectionStart === 0) {
          event.preventDefault();
          // Appliquer le changement avant de se déplacer
          if (editingCell && editingCell.rowIndex === rowIndex && editingCell.colIndex === colIndex) {
            applyCellChange(rowIndex, colIndex, editingValue);
          }
          if (colIndex > 0) {
            const targetCell = tableRef.current?.querySelector(
              `tbody tr:nth-child(${rowIndex + 1}) td:nth-child(${colIndex}) input, tbody tr:nth-child(${rowIndex + 1}) td:nth-child(${colIndex}) textarea`
            ) as HTMLElement;
            targetCell?.focus();
            (targetCell as HTMLInputElement)?.setSelectionRange(
              (targetCell as HTMLInputElement).value.length,
              (targetCell as HTMLInputElement).value.length
            );
          }
        }
        break;

      case 'ArrowRight':
        if (event.ctrlKey || input.selectionStart === input.value.length) {
          event.preventDefault();
          // Appliquer le changement avant de se déplacer
          if (editingCell && editingCell.rowIndex === rowIndex && editingCell.colIndex === colIndex) {
            applyCellChange(rowIndex, colIndex, editingValue);
          }
          if (colIndex < totalCols - 1) {
            const targetCell = tableRef.current?.querySelector(
              `tbody tr:nth-child(${rowIndex + 1}) td:nth-child(${colIndex + 2}) input, tbody tr:nth-child(${rowIndex + 1}) td:nth-child(${colIndex + 2}) textarea`
            ) as HTMLElement;
            targetCell?.focus();
            (targetCell as HTMLInputElement)?.setSelectionRange(0, 0);
          }
        }
        break;

      case 'Tab':
        event.preventDefault();
        // Appliquer le changement avant de se déplacer
        if (editingCell && editingCell.rowIndex === rowIndex && editingCell.colIndex === colIndex) {
          applyCellChange(rowIndex, colIndex, editingValue);
        }
        const direction = event.shiftKey ? -1 : 1;
        let nextColIndex = colIndex + direction;
        let nextRowIndex = rowIndex;

        if (nextColIndex >= totalCols) {
          nextColIndex = 0;
          nextRowIndex++;
        } else if (nextColIndex < 0) {
          nextColIndex = totalCols - 1;
          nextRowIndex--;
        }

        if (nextRowIndex >= 0 && nextRowIndex < totalRows) {
          const targetCell = tableRef.current?.querySelector(
            `tbody tr:nth-child(${nextRowIndex + 1}) td:nth-child(${nextColIndex + 1}) input, tbody tr:nth-child(${nextRowIndex + 1}) td:nth-child(${nextColIndex + 1}) textarea`
          ) as HTMLInputElement | HTMLTextAreaElement;
          targetCell?.focus();
          targetCell?.select();
        }
        break;

      case 'Enter':
        if (headersRef.current[colIndex] !== 'Libellé') {
          event.preventDefault();
          // Appliquer le changement avant de se déplacer
          if (editingCell && editingCell.rowIndex === rowIndex && editingCell.colIndex === colIndex) {
            applyCellChange(rowIndex, colIndex, editingValue);
          }
          input.blur();
          
          if (rowIndex < totalRows - 1) {
            const targetCell = tableRef.current?.querySelector(
              `tbody tr:nth-child(${rowIndex + 2}) td:nth-child(1) input`
            ) as HTMLInputElement | HTMLTextAreaElement;
            targetCell?.focus();
            targetCell?.select();
          }
        }
        break;
    }
  }, [editingCell, editingValue, applyCellChange]);

  const handleContextMenu = useCallback((event: React.MouseEvent, rowIndex: number) => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      targetRowIndex: rowIndex,
    });
  }, []);

  const handleInsertRow = useCallback((position: 'above' | 'below') => {
    if (onRowInsert && contextMenu) {
      onRowInsert(contextMenu.targetRowIndex, position);
      setContextMenu(null);
    }
  }, [onRowInsert, contextMenu]);

  const handleDeleteRow = useCallback(() => {
    if (onRowDelete && contextMenu) {
      const confirmed = window.confirm('Êtes-vous sûr de vouloir supprimer cette ligne ?');
      if (confirmed) {
        // Pour les suppressions, on peut les marquer localement aussi
        // Mais pour l'instant, on propage immédiatement pour garder la cohérence
        const targetRow = rowsRef.current[contextMenu.targetRowIndex];
        if (targetRow) {
          const rowKey = getRowKey(targetRow);
          // Marquer comme supprimé dans les modifications locales
          const modifiedRow = localModificationsRef.current.get(rowKey) || { ...targetRow };
          modifiedRow.deleted = true;
          modifiedRow.modified = true;
          localModificationsRef.current.set(rowKey, modifiedRow);
          startTransition(() => {
            setModifiedRowKeys(prev => {
              const newSet = new Set(prev);
              newSet.add(rowKey);
              return newSet;
            });
          });
        }
        // Et aussi propager immédiatement pour la cohérence de l'affichage
        onRowDelete(contextMenu.targetRowIndex);
        setContextMenu(null);
      }
    }
  }, [onRowDelete, contextMenu, getRowKey]);

  // Fonction pour obtenir une suggestion de catégorie (lazy loading)
  const getCategorySuggestion = useCallback((rowIndex: number, row: EditionRow): string | null | undefined => {
    // Vérifier le cache d'abord
    if (suggestionsCacheRef.current.has(rowIndex)) {
      return suggestionsCacheRef.current.get(rowIndex);
    }
    
    // Calculer la suggestion seulement si nécessaire
    const category = row.catégorie || '';
    const isEmpty = !category || category.trim() === '' || category === '???';
    
    if (isEmpty && row.Libellé && autoCategorisationStatsRef.current) {
      const suggestion = AutoCategorisationService.suggestBestCategory(
        row.Libellé,
        autoCategorisationStatsRef.current
      );
      const suggestionValue = suggestion.category || null;
      suggestionsCacheRef.current.set(rowIndex, suggestionValue);
      return suggestionValue;
    }
    
    suggestionsCacheRef.current.set(rowIndex, null);
    return null;
  }, []);

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <FontAwesomeIcon icon={faSort} className="sort-icon" />;
    }
    if (sortDirection === 'asc') {
      return <FontAwesomeIcon icon={faSortUp} className="sort-icon sort-icon-asc" />;
    }
    if (sortDirection === 'desc') {
      return <FontAwesomeIcon icon={faSortDown} className="sort-icon sort-icon-desc" />;
    }
    return <FontAwesomeIcon icon={faSort} className="sort-icon" />;
  };

  const handleHeaderClick = (column: string) => {
    if (!onSort) return;
    
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        onSort(column, 'desc');
      } else if (sortDirection === 'desc') {
        onSort(column, null);
      } else {
        onSort(column, 'asc');
      }
    } else {
      onSort(column, 'asc');
    }
  };
  
  // Seuil pour activer la virtualisation (désactivée pour petits datasets pour éviter les clignotements)
  const VIRTUALIZATION_THRESHOLD = 500;
  const shouldVirtualize = rows.length >= VIRTUALIZATION_THRESHOLD;
  
  // Virtualisation simple : ne rendre que les lignes visibles
  // Initialiser visibleRange en fonction du nombre de lignes (toutes les lignes si < seuil)
  const [visibleRange, setVisibleRange] = useState(() => {
    const initialEnd = rows.length >= VIRTUALIZATION_THRESHOLD ? Math.min(100, rows.length) : rows.length;
    return { start: 0, end: initialEnd };
  });
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const previousRowsLengthRef = useRef<number>(0);
  const measuredRowHeightRef = useRef<number | null>(null); // Hauteur mesurée dynamiquement
  const rowHeightMeasurementsRef = useRef<number[]>([]); // Cache des hauteurs mesurées
  const isScrollingRef = useRef<boolean>(false); // Suivre l'état de scroll pour désactiver les mesures
  const frozenRowHeightRef = useRef<number | null>(null); // Hauteur gelée pendant le scroll
  const OVERSCAN = 20; // Nombre de lignes à rendre en plus au-dessus et en-dessous
  const ROW_HEIGHT_FALLBACK = 50; // Hauteur de fallback si la mesure n'est pas encore disponible
  const SCROLL_UPDATE_THRESHOLD = 12; // Seuil minimum de lignes avant de mettre à jour visibleRange (augmenté pour scroll rapide)
  const SCROLL_DEBOUNCE_MS = 150; // Délai de debounce pour les mises à jour de scroll
  const SCROLL_THROTTLE_MS = 16; // Throttle à ~60fps (16ms)
  
  // Mesurer la hauteur réelle des lignes après le premier render
  // Pour les petits datasets, on peut réduire la fréquence des mesures
  useEffect(() => {
    if (!tbodyRef.current || rows.length === 0) return;
    
    const measureRowHeight = () => {
      // Ne pas mesurer pendant le scroll actif
      if (isScrollingRef.current) {
        return;
      }
      
      const firstRow = tbodyRef.current?.querySelector('tr:not([style*="visibility: hidden"])');
      if (firstRow) {
        const height = firstRow.getBoundingClientRect().height;
        if (height > 0) {
          // Validation : éviter les hauteurs aberrantes (trop petites ou trop grandes)
          const minHeight = 30;
          const maxHeight = 200;
          if (height < minHeight || height > maxHeight) {
            return;
          }
          
          // Pour les petits datasets, utiliser une moyenne plus stable (moins de mesures)
          const maxMeasurements = shouldVirtualize ? 10 : 3;
          rowHeightMeasurementsRef.current.push(height);
          if (rowHeightMeasurementsRef.current.length > maxMeasurements) {
            rowHeightMeasurementsRef.current.shift();
          }
          const averageHeight = rowHeightMeasurementsRef.current.reduce((a, b) => a + b, 0) / rowHeightMeasurementsRef.current.length;
          const roundedHeight = Math.round(averageHeight);
          
          // Ne mettre à jour que si la différence est significative (éviter les micro-changements)
          // Pour les petits datasets, on peut être plus strict sur les changements
          const threshold = shouldVirtualize ? 2 : 5;
          if (!measuredRowHeightRef.current || Math.abs(roundedHeight - measuredRowHeightRef.current) >= threshold) {
            measuredRowHeightRef.current = roundedHeight;
          }
        }
      }
    };
    
    // Mesurer après un court délai pour laisser le DOM se stabiliser
    // Pour les petits datasets, délai plus court car le DOM est plus simple
    const delay = shouldVirtualize ? 100 : 50;
    const timeoutId = setTimeout(measureRowHeight, delay);
    
    // Observer les changements de taille des lignes (gère automatiquement les changements de hauteur)
    // Pour les petits datasets, observer moins de lignes
    const resizeObserver = new ResizeObserver(() => {
      // Ne pas mesurer pendant le scroll actif
      if (!isScrollingRef.current) {
        measureRowHeight();
      }
    });
    
    // Observer plusieurs lignes pour une mesure plus précise
    const rowsToObserve = tbodyRef.current.querySelectorAll('tr:not([style*="visibility: hidden"])');
    const maxObservedRows = shouldVirtualize ? 3 : 1; // Observer moins de lignes pour les petits datasets
    rowsToObserve.forEach((row, index) => {
      if (index < maxObservedRows) {
        resizeObserver.observe(row);
      }
    });
    
    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [rows.length, shouldVirtualize]); // Mesurer seulement quand le nombre de lignes change ou si le mode de virtualisation change
  
  // Obtenir la hauteur effective à utiliser pour les calculs
  const getEffectiveRowHeight = useCallback(() => {
    // Pendant le scroll, utiliser la hauteur gelée si disponible
    if (isScrollingRef.current && frozenRowHeightRef.current !== null) {
      return frozenRowHeightRef.current;
    }
    // Sinon, utiliser la hauteur mesurée ou le fallback
    return measuredRowHeightRef.current || ROW_HEIGHT_FALLBACK;
  }, []);
  
  // Mettre à jour visibleRange quand shouldVirtualize change
  useEffect(() => {
    if (shouldVirtualize) {
      // Activer la virtualisation : limiter la plage visible
      setVisibleRange({ start: 0, end: Math.min(100, rows.length) });
    } else {
      // Désactiver la virtualisation : inclure toutes les lignes
      setVisibleRange({ start: 0, end: rows.length });
    }
  }, [shouldVirtualize, rows.length]);
  
  // Réinitialiser la plage visible quand le nombre de lignes change significativement
  // ou quand les lignes elles-mêmes changent (filtres/recherche)
  const rowsKeyRef = useRef<string>('');
  
  useEffect(() => {
    const previousLength = previousRowsLengthRef.current;
    const currentLength = rows.length;
    
    // Créer une clé basée sur les premières et dernières lignes pour détecter les changements de contenu
    const currentRowsKey = rows.length > 0 
      ? `${rows[0]?.Source}|${rows[0]?.Date}|${rows[rows.length - 1]?.Source}|${rows[rows.length - 1]?.Date}|${rows.length}`
      : `empty|${rows.length}`;
    
    const rowsChanged = rowsKeyRef.current !== currentRowsKey;
    rowsKeyRef.current = currentRowsKey;
    
    // Si le nombre de lignes a beaucoup changé OU si les lignes ont changé (filtre/recherche)
    if (rowsChanged && (previousLength === 0 || Math.abs(currentLength - previousLength) > 50 || rowsChanged)) {
      // Pour les petits datasets, initialiser la plage pour inclure toutes les lignes
      // Pour les gros datasets, utiliser la virtualisation
      if (shouldVirtualize) {
        setVisibleRange({ start: 0, end: Math.min(100, currentLength) });
      } else {
        // Pour les petits datasets, inclure toutes les lignes
        setVisibleRange({ start: 0, end: currentLength });
      }
      
      // Réinitialiser le scroll si le conteneur existe
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      
      // Forcer un re-render en vidant le cache des suggestions
      suggestionsCacheRef.current.clear();
      // Réinitialiser les mesures de hauteur seulement si nécessaire
      if (shouldVirtualize) {
        rowHeightMeasurementsRef.current = [];
        measuredRowHeightRef.current = null;
      }
    }
    
    previousRowsLengthRef.current = currentLength;
  }, [rows, shouldVirtualize]);
  
  // Calculer les lignes visibles basées sur le scroll (optimisé)
  const [pendingVisibleRange, setPendingVisibleRange] = useState({ start: 0, end: 100 });
  // useDeferredValue doit toujours être appelé (règle des hooks), mais on l'utilise seulement si nécessaire
  const deferredVisibleRange = useDeferredValue(pendingVisibleRange);
  
  // Synchroniser deferredVisibleRange avec visibleRange (seulement si virtualisation active)
  // Pour les petits datasets, utiliser directement pendingVisibleRange sans délai
  useEffect(() => {
    if (shouldVirtualize) {
      setVisibleRange(deferredVisibleRange);
    } else {
      // Pour les petits datasets, utiliser directement la plage sans délai
      setVisibleRange(pendingVisibleRange);
    }
  }, [deferredVisibleRange, pendingVisibleRange, shouldVirtualize]);
  
  useEffect(() => {
    // Ne gérer le scroll que si la virtualisation est active
    if (!shouldVirtualize) return;
    
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    
    // Trouver le conteneur parent avec le scroll (.table-wrapper)
    const findScrollContainer = (element: HTMLElement | null): HTMLElement | null => {
      if (!element) return null;
      if (element.classList.contains('table-wrapper')) {
        return element;
      }
      return findScrollContainer(element.parentElement);
    };
    
    const scrollContainer = findScrollContainer(wrapper) || wrapper;
    scrollContainerRef.current = scrollContainer;
    
    let isScrolling = false;
    let scrollTimeout: number | null = null;
    let debounceTimeout: number | null = null;
    let lastCalculatedRange = { start: 0, end: 100 };
    let lastThrottleTime = 0;
    let pendingUpdate: { start: number; end: number } | null = null;
    
    const handleScroll = () => {
      if (rows.length === 0) {
        const emptyRange = { start: 0, end: 0 };
        setPendingVisibleRange(emptyRange);
        lastCalculatedRange = emptyRange;
        return;
      }
      
      const rowHeight = getEffectiveRowHeight();
      const scrollTop = scrollContainer.scrollTop || 0;
      const containerHeight = scrollContainer.clientHeight || 600;
      
      const start = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
      const end = Math.min(
        rows.length,
        Math.ceil((scrollTop + containerHeight) / rowHeight) + OVERSCAN
      );
      
      // Appliquer un seuil pour éviter les micro-mises à jour
      const startDiff = Math.abs(start - lastCalculatedRange.start);
      const endDiff = Math.abs(end - lastCalculatedRange.end);
      
      // Mettre à jour seulement si le changement est significatif (seuil strict)
      if (startDiff >= SCROLL_UPDATE_THRESHOLD || endDiff >= SCROLL_UPDATE_THRESHOLD) {
        const newRange = { start, end };
        lastCalculatedRange = newRange;
        pendingUpdate = newRange;
        
        // Debounce les mises à jour pour éviter les clignotements
        if (debounceTimeout !== null) {
          clearTimeout(debounceTimeout);
        }
        
        debounceTimeout = window.setTimeout(() => {
          if (pendingUpdate) {
            // Utiliser startTransition seulement si la virtualisation est active
            if (shouldVirtualize) {
              startTransition(() => {
                setPendingVisibleRange(pendingUpdate!);
              });
            } else {
              setPendingVisibleRange(pendingUpdate!);
            }
            pendingUpdate = null;
          }
          debounceTimeout = null;
        }, SCROLL_DEBOUNCE_MS);
      }
    };
    
    // Throttle + requestAnimationFrame pour optimiser les calculs de scroll
    let rafId: number | null = null;
    let isFirstScroll = true;
    const optimizedHandleScroll = () => {
      // Geler la hauteur au début du scroll si c'est la première fois
      if (isFirstScroll) {
        isFirstScroll = false;
        isScrollingRef.current = true;
        // Geler la hauteur actuelle pour éviter les changements pendant le scroll
        if (measuredRowHeightRef.current !== null) {
          frozenRowHeightRef.current = measuredRowHeightRef.current;
        }
      }
      
      isScrolling = true;
      
      // Throttle à ~60fps
      const now = Date.now();
      if (now - lastThrottleTime < SCROLL_THROTTLE_MS) {
        return;
      }
      lastThrottleTime = now;
      
      if (scrollTimeout !== null) {
        clearTimeout(scrollTimeout);
      }
      
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        handleScroll();
        rafId = null;
        
        // Marquer la fin du scroll après un délai plus long
        scrollTimeout = window.setTimeout(() => {
          isScrolling = false;
          isScrollingRef.current = false;
          isFirstScroll = true;
          
          // Dégeler la hauteur après la fin du scroll
          frozenRowHeightRef.current = null;
          
          // Appliquer la dernière mise à jour en attente si elle existe
          if (pendingUpdate) {
            if (shouldVirtualize) {
              startTransition(() => {
                setPendingVisibleRange(pendingUpdate!);
              });
            } else {
              setPendingVisibleRange(pendingUpdate!);
            }
            pendingUpdate = null;
          }
        }, SCROLL_DEBOUNCE_MS);
      });
    };
    
    scrollContainer.addEventListener('scroll', optimizedHandleScroll, { passive: true });
    handleScroll(); // Calculer initialement
    
    // Observer les changements de taille du conteneur (avec debounce)
    let resizeTimeout: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimeout !== null) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = window.setTimeout(() => {
        if (!isScrolling) {
          handleScroll();
        }
      }, 100);
    });
    resizeObserver.observe(scrollContainer);
    
    return () => {
      scrollContainer.removeEventListener('scroll', optimizedHandleScroll);
      resizeObserver.disconnect();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (scrollTimeout !== null) {
        clearTimeout(scrollTimeout);
      }
      if (debounceTimeout !== null) {
        clearTimeout(debounceTimeout);
      }
      if (resizeTimeout !== null) {
        clearTimeout(resizeTimeout);
      }
    };
  }, [rows.length, getEffectiveRowHeight, shouldVirtualize]);
  
  // Calculer les lignes visibles à rendre
  const visibleRows = useMemo(() => {
    if (rows.length === 0) return [];
    // Si la virtualisation est désactivée, retourner toutes les lignes directement
    if (!shouldVirtualize) {
      return rows;
    }
    const start = Math.max(0, Math.min(visibleRange.start, rows.length - 1));
    const end = Math.min(rows.length, Math.max(start + 1, visibleRange.end));
    return rows.slice(start, end);
  }, [rows, visibleRange, shouldVirtualize]);
  
  // Calculer la hauteur totale du tableau pour maintenir le scrollbar correct (mémorisé pour éviter les recalculs)
  // Pas nécessaire si la virtualisation est désactivée
  const { offsetY, bottomSpacerHeight } = useMemo(() => {
    if (!shouldVirtualize) {
      return { offsetY: 0, bottomSpacerHeight: 0 };
    }
    const rowHeight = getEffectiveRowHeight();
    const total = rows.length * rowHeight;
    const offset = Math.max(0, Math.min(visibleRange.start, rows.length - 1)) * rowHeight;
    const visibleHeight = visibleRows.length * rowHeight;
    // Ajouter une marge d'erreur (buffer) pour compenser les variations de hauteur
    const buffer = rowHeight * 0.1; // 10% de marge
    const bottomSpacer = Math.max(0, total - offset - visibleHeight + buffer);
    
    return {
      offsetY: offset,
      bottomSpacerHeight: bottomSpacer
    };
  }, [rows.length, visibleRange.start, visibleRows.length, getEffectiveRowHeight, shouldVirtualize]);

  return (
    <div className="csv-editor-table-wrapper" ref={wrapperRef}>
      <table id="csv-table" ref={tableRef}>
        <thead>
          <tr>
            {headers.map((header, colIndex) => (
              <th
                key={header}
                className={`${onSort ? 'sortable' : ''} ${resizingColumn === colIndex ? 'resizing' : ''}`}
                onClick={(e) => {
                  // Ne pas déclencher le tri si on clique sur le handle de redimensionnement
                  if ((e.target as HTMLElement).classList.contains('column-resize-handle')) {
                    return;
                  }
                  if (onSort) {
                    handleHeaderClick(header);
                  }
                }}
                style={{ 
                  width: columnWidths[colIndex] || 'auto',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '5px' }}>
                  <span>{header}</span>
                  {onSort && getSortIcon(header)}
                </div>
                <div
                  className="column-resize-handle"
                  onMouseDown={(e) => handleResizeStart(e, colIndex)}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: '5px',
                    cursor: 'col-resize',
                    userSelect: 'none',
                    zIndex: 1
                  }}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody ref={tbodyRef}>
          {/* Espaceur pour les lignes au-dessus de la zone visible (seulement si virtualisation active) */}
          {shouldVirtualize && visibleRange.start > 0 && (
            <tr style={{ height: offsetY, visibility: 'hidden' }}>
              <td colSpan={headers.length} style={{ padding: 0, border: 'none' }} />
            </tr>
          )}
          {/* Lignes visibles */}
          {visibleRows.map((row: EditionRow, index: number) => {
            // Pour les petits datasets, utiliser directement l'index
            // Pour la virtualisation, calculer l'index réel
            const actualIndex = shouldVirtualize ? visibleRange.start + index : index;
            const suggestion = getCategorySuggestion(actualIndex, row);
            // Utiliser uniquement l'index réel pour la clé React (stable lors du scroll)
            // Le composant TableRow avec memo gérera les re-renders basés sur les props
            const stableKey = `row-${actualIndex}`;
            
            return (
              <TableRow
                key={stableKey}
                row={row}
                rowIndex={actualIndex}
                headers={headers}
                columnWidths={columnWidths}
                editingCell={editingCell}
                editingValue={editingValue}
                categorySuggestion={suggestion}
                onContextMenu={handleContextMenu}
                onCellChange={handleCellChange}
                onCellFocus={handleCellFocus}
                onCellBlur={handleCellBlur}
                onKeyDown={handleKeyDown}
                getRowWithModifications={getRowWithModifications}
                modifiedRowKeys={modifiedRowKeys}
              />
            );
          })}
          {/* Espaceur pour les lignes en-dessous de la zone visible (seulement si virtualisation active) */}
          {shouldVirtualize && bottomSpacerHeight > 0 && (
            <tr style={{ height: bottomSpacerHeight, visibility: 'hidden' }}>
              <td colSpan={headers.length} style={{ padding: 0, border: 'none' }} />
            </tr>
          )}
        </tbody>
      </table>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{
            position: 'fixed',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            zIndex: 1000,
          }}
        >
          <div
            className="context-menu-item"
            onClick={() => handleInsertRow('above')}
          >
            <FontAwesomeIcon icon={faArrowUp} />
            Insérer une ligne au-dessus
          </div>
          <div
            className="context-menu-item"
            onClick={() => handleInsertRow('below')}
          >
            <FontAwesomeIcon icon={faArrowDown} />
            Insérer une ligne en-dessous
          </div>
          <div
            className="context-menu-item text-danger"
            onClick={handleDeleteRow}
          >
            <FontAwesomeIcon icon={faTrashAlt} />
            Supprimer cette ligne
          </div>
        </div>
      )}
    </div>
  );
});

CsvEditorTable.displayName = 'CsvEditorTable';

export default CsvEditorTable;

