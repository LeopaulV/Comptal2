import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faEdit, faTrash, faSave, faTimes, faPlus } from '@fortawesome/free-solid-svg-icons';
import { CategoriesConfig } from '../../types/Category';
import { ConfigService } from '../../services/ConfigService';

interface CategoryLegendPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCategoriesChange?: () => void;
}

const CategoryLegendPanel: React.FC<CategoryLegendPanelProps> = ({
  isCollapsed,
  onToggleCollapse,
  onCategoriesChange,
}) => {
  const [categories, setCategories] = useState<CategoriesConfig>({});
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editedCategory, setEditedCategory] = useState<{ name: string; color: string } | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newCategory, setNewCategory] = useState({ code: '', name: '', color: '#0ea5e9' });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const config = await ConfigService.loadCategories();
      setCategories(config);
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error);
    }
  };

  const handleStartEdit = (code: string) => {
    if (code === 'X') return; // Ne pas permettre l'édition de X
    setEditingCode(code);
    setEditedCategory({ ...categories[code] });
  };

  const handleSaveEdit = async (code: string) => {
    if (editedCategory && code !== 'X') {
      const updated = { ...categories, [code]: editedCategory };
      await ConfigService.saveCategories(updated);
      ConfigService.clearCache(); // Invalider le cache pour forcer le rechargement
      setCategories(updated);
      setEditingCode(null);
      setEditedCategory(null);
      if (onCategoriesChange) {
        onCategoriesChange();
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingCode(null);
    setEditedCategory(null);
  };

  const handleDelete = async (code: string) => {
    if (code === 'X') return; // Ne pas permettre la suppression de X
    if (confirm(`Êtes-vous sûr de vouloir supprimer la catégorie "${categories[code].name}" ?`)) {
      const { [code]: deleted, ...rest } = categories;
      await ConfigService.saveCategories(rest);
      ConfigService.clearCache(); // Invalider le cache pour forcer le rechargement
      setCategories(rest);
      if (onCategoriesChange) {
        onCategoriesChange();
      }
    }
  };

  const handleAdd = async () => {
    if (!newCategory.code || !newCategory.name) {
      alert('Veuillez remplir tous les champs');
      return;
    }

    if (categories[newCategory.code]) {
      alert('Ce code de catégorie existe déjà');
      return;
    }

    const updated = {
      ...categories,
      [newCategory.code]: {
        name: newCategory.name,
        color: newCategory.color,
      },
    };

    await ConfigService.saveCategories(updated);
    ConfigService.clearCache(); // Invalider le cache pour forcer le rechargement
    setCategories(updated);
    setIsAdding(false);
    setNewCategory({ code: '', name: '', color: '#0ea5e9' });
    if (onCategoriesChange) {
      onCategoriesChange();
    }
  };

  const getDisplayName = (code: string, name: string): string => {
    if (code === 'X') {
      return 'Transfert inter comptes (TIC)';
    }
    return name;
  };

  if (isCollapsed) {
    return (
      <div className="category-legend-panel collapsed">
        <button
          className="collapse-button"
          onClick={onToggleCollapse}
          title="Afficher la légende des catégories"
        >
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
      </div>
    );
  }

  return (
    <div className="category-legend-panel">
      <div className="legend-header">
        <h3>Légende des catégories</h3>
        <button
          className="collapse-button"
          onClick={onToggleCollapse}
          title="Masquer la légende"
        >
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </div>

      <div className="legend-content">
        <div className="legend-list">
          {Object.entries(categories)
            .filter(([code]) => code !== '???' && code !== '!!!')
            .map(([code, category]) => {
              const isEditing = editingCode === code;
              const displayCategory = isEditing && editedCategory ? editedCategory : category;
              const canEdit = code !== 'X';
              const color = displayCategory.color || '#cccccc';

              return (
                <div
                  key={code}
                  className={`legend-item ${isEditing ? 'editing' : ''}`}
                >
                  <div className="legend-item-color">
                    {isEditing ? (
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setEditedCategory({ ...displayCategory, color: e.target.value })}
                        className="color-input"
                      />
                    ) : (
                      <div
                        className="color-preview"
                        style={{ backgroundColor: color }}
                      />
                    )}
                  </div>

                  <div className="legend-item-info">
                    {isEditing ? (
                      <input
                        type="text"
                        value={displayCategory.name}
                        onChange={(e) => setEditedCategory({ ...displayCategory, name: e.target.value })}
                        className="name-input"
                        placeholder="Nom de la catégorie"
                      />
                    ) : (
                      <>
                        <div className="legend-item-name">
                          {getDisplayName(code, displayCategory.name)}
                        </div>
                        <div className="legend-item-code">{code}</div>
                      </>
                    )}
                  </div>

                  <div className="legend-item-actions">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(code)}
                          className="action-btn save-btn"
                          title="Sauvegarder"
                        >
                          <FontAwesomeIcon icon={faSave} />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="action-btn cancel-btn"
                          title="Annuler"
                        >
                          <FontAwesomeIcon icon={faTimes} />
                        </button>
                      </>
                    ) : (
                      <>
                        {canEdit && (
                          <button
                            onClick={() => handleStartEdit(code)}
                            className="action-btn edit-btn"
                            title="Éditer"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => handleDelete(code)}
                            className="action-btn delete-btn"
                            title="Supprimer"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {isAdding ? (
          <div className="add-category-form">
            <h4>Nouvelle catégorie</h4>
            <div className="form-group">
              <label>Code</label>
              <input
                type="text"
                value={newCategory.code}
                onChange={(e) => setNewCategory({ ...newCategory, code: e.target.value.toUpperCase() })}
                placeholder="Ex: A, B, C..."
                maxLength={5}
              />
            </div>
            <div className="form-group">
              <label>Nom</label>
              <input
                type="text"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                placeholder="Ex: Alimentaire..."
              />
            </div>
            <div className="form-group">
              <label>Couleur</label>
              <input
                type="color"
                value={newCategory.color}
                onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                className="color-input"
              />
            </div>
            <div className="form-actions">
              <button onClick={handleAdd} className="btn-primary">
                Ajouter
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewCategory({ code: '', name: '', color: '#0ea5e9' });
                }}
                className="btn-secondary"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="add-category-btn"
          >
            <FontAwesomeIcon icon={faPlus} />
            Ajouter une catégorie
          </button>
        )}
      </div>
    </div>
  );
};

export default CategoryLegendPanel;

