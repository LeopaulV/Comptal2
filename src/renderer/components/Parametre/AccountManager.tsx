import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, Palette } from 'lucide-react';
import { AccountsConfig } from '../../types/Account';
import { ConfigService } from '../../services/ConfigService';
import { Button } from '../Common';
import PalettePreviewModal from './PalettePreviewModal';
import { PaletteApplication } from '../../types/ColorPalette';

const AccountManager: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountsConfig>({});
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editedAccount, setEditedAccount] = useState<{ name: string; color: string } | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newAccount, setNewAccount] = useState({ code: '', name: '', color: '#0ea5e9' });
  const [showPaletteModal, setShowPaletteModal] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const config = await ConfigService.loadAccounts();
    setAccounts(config);
  };

  const handleStartEdit = (code: string) => {
    setEditingCode(code);
    setEditedAccount({ ...accounts[code] });
  };

  const handleSaveEdit = async (code: string) => {
    if (editedAccount) {
      const updated = { ...accounts, [code]: editedAccount };
      await ConfigService.saveAccounts(updated);
      setAccounts(updated);
      setEditingCode(null);
      setEditedAccount(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingCode(null);
    setEditedAccount(null);
  };

  const handleDelete = async (code: string) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le compte "${accounts[code].name}" ?`)) {
      const { [code]: deleted, ...rest } = accounts;
      await ConfigService.saveAccounts(rest);
      setAccounts(rest);
    }
  };

  const handleAdd = async () => {
    if (!newAccount.code || !newAccount.name) {
      alert('Veuillez remplir tous les champs');
      return;
    }

    if (accounts[newAccount.code]) {
      alert('Ce code de compte existe déjà');
      return;
    }

    const updated = {
      ...accounts,
      [newAccount.code]: {
        name: newAccount.name,
        color: newAccount.color,
      },
    };

    await ConfigService.saveAccounts(updated);
    setAccounts(updated);
    setIsAdding(false);
    setNewAccount({ code: '', name: '', color: '#0ea5e9' });
  };

  const handleApplyPalette = async (applications: PaletteApplication[]) => {
    const updated = { ...accounts };
    applications.forEach((app) => {
      if (updated[app.itemCode]) {
        updated[app.itemCode] = {
          ...updated[app.itemCode],
          color: app.newColor,
        };
      }
    });
    await ConfigService.saveAccounts(updated);
    setAccounts(updated);
  };

  const getAccountItems = () => {
    return Object.entries(accounts).map(([code, account]) => ({
      code,
      name: account.name,
      color: account.color,
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

      {/* Liste des comptes */}
      <div className="space-y-2">
        {Object.entries(accounts).map(([code, account]) => {
          const isEditing = editingCode === code;
          const displayAccount = isEditing && editedAccount ? editedAccount : account;

          return (
            <div
              key={code}
              className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              {/* Couleur */}
              <div className="flex-shrink-0">
                {isEditing ? (
                  <input
                    type="color"
                    value={displayAccount.color}
                    onChange={(e) => setEditedAccount({ ...displayAccount, color: e.target.value })}
                    className="w-12 h-12 rounded cursor-pointer"
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded"
                    style={{ backgroundColor: displayAccount.color }}
                  />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={displayAccount.name}
                      onChange={(e) => setEditedAccount({ ...displayAccount, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                               bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="Nom du compte"
                    />
                  </div>
                ) : (
                  <>
                    <p className="font-semibold text-gray-900 dark:text-white">{displayAccount.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{code}</p>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => handleSaveEdit(code)}
                      className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                      title="Sauvegarder"
                    >
                      <Save size={18} />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-2 text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      title="Annuler"
                    >
                      <X size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleStartEdit(code)}
                      className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                      title="Éditer"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(code)}
                      className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ajouter un compte */}
      {isAdding ? (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-300 dark:border-blue-700">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Nouveau compte</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Code du compte
              </label>
              <input
                type="text"
                value={newAccount.code}
                onChange={(e) => setNewAccount({ ...newAccount, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Ex: BNP, HSBC..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nom du compte
              </label>
              <input
                type="text"
                value={newAccount.name}
                onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Ex: BNP Paribas Compte Courant"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Couleur
              </label>
              <input
                type="color"
                value={newAccount.color}
                onChange={(e) => setNewAccount({ ...newAccount, color: e.target.value })}
                className="w-20 h-10 rounded cursor-pointer"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleAdd}>
                Ajouter
              </Button>
              <Button variant="secondary" onClick={() => {
                setIsAdding(false);
                setNewAccount({ code: '', name: '', color: '#0ea5e9' });
              }}>
                Annuler
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button variant="secondary" icon={<Plus size={18} />} onClick={() => setIsAdding(true)}>
          Ajouter un compte
        </Button>
      )}

      {/* Modal de sélection de palette */}
      <PalettePreviewModal
        isOpen={showPaletteModal}
        onClose={() => setShowPaletteModal(false)}
        items={getAccountItems()}
        onApply={handleApplyPalette}
        title="Comptes"
      />
    </div>
  );
};

export default AccountManager;

