import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { AccountsConfig } from '../../types/Account';
import { ConfigService } from '../../services/ConfigService';
import { Button } from '../Common';

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (code: string) => void;
  existingAccounts: AccountsConfig;
}

const validateAccountCode = (code: string): { valid: boolean; message?: string } => {
  if (!code) {
    return { valid: false, message: 'Le code ne peut pas être vide' };
  }
  const validPattern = /^[A-Za-z0-9]+$/;
  if (!validPattern.test(code)) {
    return {
      valid: false,
      message: 'Le code ne peut contenir que des lettres (A-Z) et des chiffres (0-9). Les caractères spéciaux et les underscores sont interdits.',
    };
  }
  return { valid: true };
};

const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  existingAccounts,
}) => {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#0ea5e9');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCode('');
      setName('');
      setColor('#0ea5e9');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code.trim() || !name.trim()) {
      setError(t('upload.createAccountModal.fillAll', 'Veuillez remplir tous les champs'));
      return;
    }

    const trimmedCode = code.trim().toUpperCase();
    const validation = validateAccountCode(trimmedCode);
    if (!validation.valid) {
      setError(validation.message || '');
      return;
    }

    if (existingAccounts[trimmedCode]) {
      setError(t('upload.createAccountModal.codeExists', 'Ce code de compte existe déjà'));
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = {
        ...existingAccounts,
        [trimmedCode]: { name: name.trim(), color },
      };
      await ConfigService.saveAccounts(updated);
      onCreated(trimmedCode);
      onClose();
    } catch (err: any) {
      setError(err?.message || t('upload.createAccountModal.saveError', 'Erreur lors de la sauvegarde'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('upload.createAccountModal.title', 'Nouveau compte')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('upload.createAccountModal.codeLabel', 'Code du compte')}
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => {
                const filtered = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                setCode(filtered);
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Ex: BNP, HSBC..."
              maxLength={20}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('upload.createAccountModal.nameLabel', 'Nom du compte')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Ex: BNP Paribas Compte Courant"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('upload.createAccountModal.colorLabel', 'Couleur')}
            </label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-20 h-10 rounded cursor-pointer"
            />
          </div>

          <div className="flex gap-4 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" type="button" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : t('upload.createAccountModal.create', 'Créer')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAccountModal;
