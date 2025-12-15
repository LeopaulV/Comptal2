import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, Palette } from 'lucide-react';
import { CategoriesConfig } from '../../types/Category';
import { ConfigService } from '../../services/ConfigService';
import { CodeUpdateService } from '../../services/CodeUpdateService';
import { DataService } from '../../services/DataService';
import { Button } from '../Common';
import PalettePreviewModal from './PalettePreviewModal';
import { PaletteApplication } from '../../types/ColorPalette';

const CategoryManager: React.FC = () => {
  const [categories, setCategories] = useState<CategoriesConfig>({});
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editedCategory, setEditedCategory] = useState<{ code: string; name: string; color: string } | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newCategory, setNewCategory] = useState({ code: '', name: '', color: '#0ea5e9' });
  const [showPaletteModal, setShowPaletteModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const config = await ConfigService.loadCategories();
    setCategories(config);
  };

  const handleStartEdit = (code: string) => {
    if (code === 'X') {
      alert('La catégorie "X" ne peut pas être modifiée.');
      return;
    }
    setEditingCode(code);
    setEditedCategory({ code, ...categories[code] });
  };

  const handleSaveEdit = async (oldCode: string) => {
    if (!editedCategory) return;

    const newCode = editedCategory.code.trim().toUpperCase();
    
    // Validation
    if (!newCode) {
      alert('Le code ne peut pas être vide');
      return;
    }

    if (newCode.length !== 1) {
      alert('Le code doit être exactement un seul caractère');
      return;
    }

    if (newCode === 'X') {
      alert('Le code "X" est réservé et ne peut pas être utilisé.');
      return;
    }

    // Vérifier si le nouveau code existe déjà (sauf si c'est le même)
    if (newCode !== oldCode && categories[newCode]) {
      alert('Ce code de catégorie existe déjà');
      return;
    }

    setIsUpdating(true);
    try {
      // Si le code a changé, mettre à jour les fichiers CSV
      if (newCode !== oldCode) {
        const filesModified = await CodeUpdateService.updateCategoryCodeInCSV(oldCode, newCode);
        console.log(`[CategoryManager] ${filesModified} fichier(s) CSV mis à jour`);
        
        if (filesModified > 0) {
          // Recharger les données
          await DataService.reload();
        }
      }

      // Mettre à jour la configuration
      const { code: _, ...categoryData } = editedCategory;
      let updated: CategoriesConfig;
      
      // Supprimer l'ancien code et ajouter le nouveau
      if (newCode !== oldCode) {
        const { [oldCode]: removed, ...rest } = categories;
        updated = { ...rest, [newCode]: categoryData };
      } else {
        updated = { ...categories, [oldCode]: categoryData };
      }

      await ConfigService.saveCategories(updated);
      setCategories(updated);
      setEditingCode(null);
      setEditedCategory(null);
    } catch (error: any) {
      console.error('[CategoryManager] Erreur lors de la sauvegarde:', error);
      alert(`Erreur lors de la sauvegarde: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingCode(null);
    setEditedCategory(null);
  };

  const handleDelete = async (code: string) => {
    if (code === 'X') {
      alert('La catégorie "X" ne peut pas être supprimée.');
      return;
    }
    if (confirm(`Êtes-vous sûr de vouloir supprimer la catégorie "${categories[code].name}" ?`)) {
      const { [code]: deleted, ...rest } = categories;
      await ConfigService.saveCategories(rest);
      setCategories(rest);
    }
  };

  const handleAdd = async () => {
    const code = newCategory.code.trim().toUpperCase();
    
    if (!code || !newCategory.name) {
      alert('Veuillez remplir tous les champs');
      return;
    }

    if (code.length !== 1) {
      alert('Le code doit être exactement un seul caractère');
      return;
    }

    if (categories[code]) {
      alert('Ce code de catégorie existe déjà');
      return;
    }

    const updated = {
      ...categories,
      [code]: {
        name: newCategory.name,
        color: newCategory.color,
      },
    };

    await ConfigService.saveCategories(updated);
    setCategories(updated);
    setIsAdding(false);
    setNewCategory({ code: '', name: '', color: '#0ea5e9' });
  };

  const handleApplyPalette = async (applications: PaletteApplication[]) => {
    const updated = { ...categories };
    applications.forEach((app) => {
      // Empêcher la modification de la catégorie "X"
      if (app.itemCode === 'X') {
        return;
      }
      if (updated[app.itemCode]) {
        updated[app.itemCode] = {
          ...updated[app.itemCode],
          color: app.newColor,
        };
      }
    });
    await ConfigService.saveCategories(updated);
    setCategories(updated);
  };

  const getCategoryItems = () => {
    return Object.entries(categories).map(([code, category]) => ({
      code,
      name: category.name,
      color: category.color,
    }));
  };

  return (
    <div className="space-y-4">
      {/* Bouton appliquer palette */}
      <div className="flex justify-end">
        <Button
          variant="secondary"
          icon={<Palette size={18} />}
          onClick={() => setShowPaletteModal(true)}
        >
          Appliquer une palette
        </Button>
      </div>

      {/* Liste des catégories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(categories).map(([code, category]) => {
          const isEditing = editingCode === code;
          const displayCategory = isEditing && editedCategory ? editedCategory : category;

          return (
            <div
              key={code}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              {/* Couleur */}
              <div className="flex-shrink-0">
                {isEditing && code !== 'X' ? (
                  <input
                    type="color"
                    value={editedCategory?.color || ''}
                    onChange={(e) => setEditedCategory(editedCategory ? { ...editedCategory, color: e.target.value } : null)}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded"
                    style={{ backgroundColor: displayCategory.color }}
                  />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                {isEditing && code !== 'X' ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editedCategory?.code || ''}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase().slice(0, 1);
                        setEditedCategory({ ...editedCategory!, code: value });
                      }}
                      className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded
                               bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
                      placeholder="Code (ex: A, B, C...)"
                      maxLength={1}
                    />
                    <input
                      type="text"
                      value={displayCategory.name}
                      onChange={(e) => setEditedCategory({ ...editedCategory!, name: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded
                               bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                      placeholder="Nom de la catégorie"
                    />
                  </div>
                ) : (
                  <>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{displayCategory.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{code}</p>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => handleSaveEdit(code)}
                      disabled={isUpdating}
                      className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Sauvegarder"
                    >
                      <Save size={16} />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-1.5 text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                      title="Annuler"
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    {code !== 'X' && (
                      <button
                        onClick={() => handleStartEdit(code)}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                        title="Éditer"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                    {code !== 'X' && (
                      <button
                        onClick={() => handleDelete(code)}
                        className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    {code === 'X' && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 px-2" title="Catégorie protégée">
                        Protégée
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ajouter une catégorie */}
      {isAdding ? (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-300 dark:border-blue-700">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Nouvelle catégorie</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Code de la catégorie
              </label>
              <input
                type="text"
                value={newCategory.code}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase().slice(0, 1);
                  setNewCategory({ ...newCategory, code: value });
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Ex: A, B, C..."
                maxLength={1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nom de la catégorie
              </label>
              <input
                type="text"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Ex: Alimentaire, Transport..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Couleur
              </label>
              <input
                type="color"
                value={newCategory.color}
                onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                className="w-20 h-10 rounded cursor-pointer"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleAdd}>
                Ajouter
              </Button>
              <Button variant="secondary" onClick={() => {
                setIsAdding(false);
                setNewCategory({ code: '', name: '', color: '#0ea5e9' });
              }}>
                Annuler
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button variant="secondary" icon={<Plus size={18} />} onClick={() => setIsAdding(true)}>
          Ajouter une catégorie
        </Button>
      )}

      {/* Modal de sélection de palette */}
      <PalettePreviewModal
        isOpen={showPaletteModal}
        onClose={() => setShowPaletteModal(false)}
        items={getCategoryItems()}
        onApply={handleApplyPalette}
        title="Catégories"
      />
    </div>
  );
};

export default CategoryManager;

