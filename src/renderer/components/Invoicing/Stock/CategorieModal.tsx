import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StockCategorie, TypeCategorie } from '../../../types/Stock';
import { StockService } from '../../../services/StockService';

interface CategorieModalProps {
  isOpen: boolean;
  categorie?: StockCategorie | null;
  onClose: () => void;
  onSaved: () => void;
}

export const CategorieModal: React.FC<CategorieModalProps> = ({ isOpen, categorie, onClose, onSaved }) => {
  const { t } = useTranslation();
  const [nom, setNom] = useState(categorie?.nom || '');
  const [description, setDescription] = useState(categorie?.description || '');
  const [couleur, setCouleur] = useState(categorie?.couleur || '#1955a3');
  const [type, setType] = useState<TypeCategorie>(categorie?.type || 'mixte');

  useEffect(() => {
    if (isOpen) {
      setNom(categorie?.nom || '');
      setDescription(categorie?.description || '');
      setCouleur(categorie?.couleur || '#1955a3');
      setType(categorie?.type || 'mixte');
    }
  }, [isOpen, categorie?.id, categorie?.nom, categorie?.description, categorie?.couleur, categorie?.type]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!nom.trim()) return;
    const now = new Date();
    await StockService.upsertCategorie({
      id: categorie?.id || StockService.generateId('CAT'),
      nom: nom.trim(),
      description: description || undefined,
      couleur: couleur || undefined,
      type,
      createdAt: categorie?.createdAt || now,
      updatedAt: now,
    });
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-xl">
        <div className="invoicing-header-row">
          <h2>{categorie ? t('invoicing.stock.editCategory') : t('invoicing.stock.newCategory')}</h2>
          <button type="button" className="secondary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
        <div className="invoicing-form-grid" style={{ marginTop: 16 }}>
          <label>
            {t('invoicing.stock.categoryName')}
            <input value={nom} onChange={(e) => setNom(e.target.value)} />
          </label>
          <label>
            {t('invoicing.stock.categoryType')}
            <select value={type} onChange={(e) => setType(e.target.value as TypeCategorie)}>
              <option value="materiel">{t('invoicing.stock.categoryTypes.materiel')}</option>
              <option value="achat">{t('invoicing.stock.categoryTypes.achat')}</option>
              <option value="mixte">{t('invoicing.stock.categoryTypes.mixte')}</option>
            </select>
          </label>
          <label>
            {t('invoicing.stock.color')}
            <input type="color" value={couleur} onChange={(e) => setCouleur(e.target.value)} />
          </label>
          <label>
            {t('invoicing.stock.description')}
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>
        <div className="invoicing-header-row" style={{ marginTop: 16 }}>
          <span />
          <button type="button" className="primary" onClick={handleSave}>
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
