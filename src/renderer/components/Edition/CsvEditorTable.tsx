import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort, faSortUp, faSortDown, faTrashAlt, faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons';
import { EditionRow } from '../../types/Edition';
import { ConfigService } from '../../services/ConfigService';

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

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetRowIndex: number;
}

const CsvEditorTable: React.FC<CsvEditorTableProps> = ({
  headers,
  rows,
  onRowsChange,
  onRowInsert,
  onRowDelete,
  onSort,
  sortColumn,
  sortDirection,
  categorySuggestions = {},
}) => {
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
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

  /**
   * Obtient le nom de compte attendu depuis le Source
   */
  const getExpectedAccountName = (source: string): string | null => {
    const prefix = extractAccountPrefix(source);
    const accountData = bankAccounts[prefix];
    if (!accountData) return null;
    
    return typeof accountData === 'object' && accountData !== null && 'name' in accountData
      ? accountData.name
      : String(accountData);
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

  const handleCellChange = useCallback((rowIndex: number, colIndex: number, value: string) => {
    const newRows = [...rows];
    const header = headers[colIndex];
    const currentRow = newRows[rowIndex];
    
    // VALIDATION : Empêcher la modification de la catégorie "X"
    if (header === 'catégorie' && currentRow.catégorie === 'X') {
      alert('La catégorie "X" ne peut pas être modifiée.');
      return;
    }
    
    // VALIDATION : Empêcher la modification incohérente du champ Compte
    if (header === 'Compte' && currentRow.Source) {
      const expectedAccountName = getExpectedAccountName(currentRow.Source);
      
      if (expectedAccountName && value !== expectedAccountName) {
        const prefix = extractAccountPrefix(currentRow.Source);
        console.warn(
          `[CsvEditorTable] Tentative de modification incohérente du Compte: ` +
          `valeur="${value}" vs attendu="${expectedAccountName}" (préfixe: ${prefix})`
        );
        
        // Afficher un avertissement à l'utilisateur
        const confirmed = window.confirm(
          `Le compte "${value}" ne correspond pas au préfixe du fichier source "${currentRow.Source}" ` +
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
            `malgré l'incohérence avec le Source "${currentRow.Source}"`
          );
        }
      }
    }
    
    if (header === 'Débit' || header === 'Crédit' || header === 'Solde') {
      // Normaliser les valeurs numériques
      const numValue = parseFloat(value.replace(',', '.').replace(/\s/g, '')) || 0;
      if (header === 'Débit') {
        newRows[rowIndex] = {
          ...newRows[rowIndex],
          [header]: numValue !== 0 ? -Math.abs(numValue) : 0,
          modified: true,
        };
      } else if (header === 'Crédit') {
        newRows[rowIndex] = {
          ...newRows[rowIndex],
          [header]: numValue !== 0 ? Math.abs(numValue) : 0,
          modified: true,
        };
      } else {
        newRows[rowIndex] = {
          ...newRows[rowIndex],
          [header]: numValue,
          modified: true,
        };
      }
    } else {
      newRows[rowIndex] = {
        ...newRows[rowIndex],
        [header]: value,
        modified: true,
      };
    }

    onRowsChange(newRows);
  }, [rows, headers, onRowsChange, bankAccounts]);

  const handleCellFocus = useCallback((rowIndex: number, colIndex: number) => {
    setEditingCell({ rowIndex, colIndex });
  }, []);

  const handleCellBlur = useCallback(() => {
    // Délai pour permettre les clics sur le menu contextuel
    setTimeout(() => {
      setEditingCell(null);
    }, 200);
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    const totalRows = rows.length;
    const totalCols = headers.length;

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
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
        if (rowIndex < totalRows - 1) {
          const targetCell = tableRef.current?.querySelector(
            `tbody tr:nth-child(${rowIndex + 2}) td:nth-child(${colIndex + 1}) input, tbody tr:nth-child(${rowIndex + 2}) td:nth-child(${colIndex + 1}) textarea`
          ) as HTMLInputElement | HTMLTextAreaElement;
          targetCell?.focus();
          targetCell?.select();
        }
        break;

      case 'ArrowLeft':
        if (event.ctrlKey || (event.target as HTMLInputElement).selectionStart === 0) {
          event.preventDefault();
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
        const input = event.target as HTMLInputElement;
        if (event.ctrlKey || input.selectionStart === input.value.length) {
          event.preventDefault();
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
        if (headers[colIndex] !== 'Libellé') {
          event.preventDefault();
          const input = event.target as HTMLInputElement;
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
  }, [rows.length, headers]);

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
        onRowDelete(contextMenu.targetRowIndex);
        setContextMenu(null);
      }
    }
  }, [onRowDelete, contextMenu]);

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

  const formatCellValue = (value: any, header: string): string => {
    if (value === null || value === undefined) return '';
    if (header === 'Débit' || header === 'Crédit' || header === 'Solde') {
      const num = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
      return num === 0 ? '0' : num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return String(value);
  };

  return (
    <div className="csv-editor-table-wrapper">
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
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={`row-${rowIndex}`}
              className={`${row.modified ? 'modified-row' : ''} ${row.deleted ? 'deleted-row' : ''}`}
              onContextMenu={(e) => handleContextMenu(e, rowIndex)}
            >
              {headers.map((header, colIndex) => {
                const value = row[header as keyof EditionRow];
                const displayValue = formatCellValue(value, header);
                const isLibelle = header === 'Libellé';
                const isCategory = header === 'catégorie';
                const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;
                const suggestion = categorySuggestions[rowIndex];
                const hasSuggestion = isCategory && suggestion && (!displayValue || displayValue.trim() === '' || displayValue === '???');

                return (
                  <td 
                    key={`${rowIndex}-${colIndex}`}
                    style={{ width: columnWidths[colIndex] || 'auto' }}
                  >
                    {isLibelle ? (
                      <div className="label-cell-content">
                        <textarea
                          value={displayValue}
                          onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                          onFocus={() => handleCellFocus(rowIndex, colIndex)}
                          onBlur={handleCellBlur}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                          className="form-control form-control-sm libelle-textarea"
                          rows={1}
                        />
                      </div>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          value={displayValue}
                          onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                          onFocus={() => handleCellFocus(rowIndex, colIndex)}
                          onBlur={handleCellBlur}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                          className="form-control form-control-sm"
                          style={{
                            textAlign: header === 'Débit' || header === 'Crédit' || header === 'Solde' ? 'right' : 'left',
                            ...(isCategory && displayValue === 'X' ? { backgroundColor: '#fee2e2', cursor: 'not-allowed' } : {}),
                          }}
                          disabled={isCategory && displayValue === 'X'}
                          placeholder={hasSuggestion ? `Suggéré: ${suggestion}` : undefined}
                        />
                        {hasSuggestion && !isEditing && (
                          <span className="suggestion-badge">
                            <span>💡</span>
                            <span>{suggestion}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
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
};

export default CsvEditorTable;

