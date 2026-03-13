import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArticleStock, ModePaiementAchat, StockCategorie, TypeArticle } from '../../../types/Stock';
import { StockService } from '../../../services/StockService';
import { UNITES_MESURE } from '../../../constants/invoicingConstants';

interface ArticleModalProps {
  isOpen: boolean;
  categories: StockCategorie[];
  article?: ArticleStock | null;
  initialCategorieId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export const ArticleModal: React.FC<ArticleModalProps> = ({
  isOpen,
  categories,
  article,
  initialCategorieId,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [designation, setDesignation] = useState(article?.designation || '');
  const [type, setType] = useState<TypeArticle>(article?.type || 'achat_ponctuel');
  const [categorieId, setCategorieId] = useState<string>(
    article?.categorieId || initialCategorieId || '',
  );
  const [valeurAcquisitionHT, setValeurAcquisitionHT] = useState<number>(article?.valeurAcquisitionHT || 0);
  const [tauxTVA, setTauxTVA] = useState<number>(article?.tauxTVA ?? 20);
  const [dateAcquisition, setDateAcquisition] = useState<string>(
    article?.dateAcquisition ? article.dateAcquisition.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const [fournisseur, setFournisseur] = useState(article?.fournisseur || '');
  const [factureRef, setFactureRef] = useState(article?.factureRef || '');
  const [reference, setReference] = useState(article?.reference || '');
  const [modePaiement, setModePaiement] = useState<ModePaiementAchat>(article?.modePaiement || 'virement');
  const [dureeAmortissement, setDureeAmortissement] = useState<number>(article?.dureeAmortissement || 0);
  const [unite, setUnite] = useState<string>(article?.unite || 'unite');
  const [quantite, setQuantite] = useState<number | ''>(article?.quantite ?? '');
  const [nbElementsParRef, setNbElementsParRef] = useState<number | ''>(article?.nbElementsParRef ?? '');
  const [besoin, setBesoin] = useState<number | ''>(article?.besoin ?? '');
  const [couleur, setCouleur] = useState(article?.couleur || categories.find((c) => c.id === (article?.categorieId || initialCategorieId))?.couleur || '#dbeafe');

  const showDureeAmortissement = useMemo(
    () => type === 'immobilisation' || type === 'achat_ponctuel',
    [type],
  );
  const showInventaireFields = useMemo(
    () => type === 'stock' || type === 'consommable',
    [type],
  );

  useEffect(() => {
    if (isOpen) {
      setDesignation(article?.designation || '');
      setType(article?.type || 'achat_ponctuel');
      setCategorieId(article?.categorieId || initialCategorieId || '');
      setValeurAcquisitionHT(article?.valeurAcquisitionHT || 0);
      setTauxTVA(article?.tauxTVA ?? 20);
      setDateAcquisition(
        article?.dateAcquisition
          ? article.dateAcquisition.toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
      );
      setFournisseur(article?.fournisseur || '');
      setFactureRef(article?.factureRef || '');
      setReference(article?.reference || '');
      setModePaiement(article?.modePaiement || 'virement');
      setDureeAmortissement(article?.dureeAmortissement || 0);
      setUnite(article?.unite || 'unite');
      setQuantite(article?.quantite ?? '');
      setNbElementsParRef(article?.nbElementsParRef ?? '');
      setBesoin(article?.besoin ?? '');
      setCouleur(article?.couleur || categories.find((c) => c.id === (article?.categorieId || initialCategorieId))?.couleur || '#dbeafe');
    }
  }, [isOpen, article, initialCategorieId, categories]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!designation.trim()) return;
    const now = new Date();
    await StockService.upsertArticle({
      id: article?.id || StockService.generateId('ART'),
      designation: designation.trim(),
      type,
      categorieId: categorieId || undefined,
      valeurAcquisitionHT: Number(valeurAcquisitionHT || 0),
      tauxTVA: Number(tauxTVA || 0),
      dateAcquisition: new Date(dateAcquisition),
      fournisseur: fournisseur || undefined,
      factureRef: factureRef || undefined,
      reference: reference || undefined,
      modePaiement,
      dureeAmortissement: showDureeAmortissement ? Number(dureeAmortissement || 0) : undefined,
      methodeAmortissement: showDureeAmortissement ? 'lineaire' : 'non_amortissable',
      statut: article?.statut || 'actif',
      unite: showInventaireFields ? unite : undefined,
      quantite: showInventaireFields && quantite !== '' ? Number(quantite) : undefined,
      nbElementsParRef: showInventaireFields && nbElementsParRef !== '' ? Number(nbElementsParRef) : undefined,
      besoin: showInventaireFields && besoin !== '' ? Number(besoin) : undefined,
      couleur: couleur || undefined,
      createdAt: article?.createdAt || now,
      updatedAt: now,
    });
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="invoicing-header-row">
          <h2>{article ? t('invoicing.stock.editArticle') : t('invoicing.stock.newArticle')}</h2>
          <button type="button" className="secondary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
        <div className="invoicing-form-grid" style={{ marginTop: 16 }}>
          <label>
            {t('invoicing.stock.designation')}
            <input value={designation} onChange={(e) => setDesignation(e.target.value)} />
          </label>
          <label>
            {t('invoicing.stock.type')}
            <select value={type} onChange={(e) => setType(e.target.value as TypeArticle)}>
              <option value="immobilisation">{t('invoicing.stock.typeOptions.immobilisation')}</option>
              <option value="stock">{t('invoicing.stock.typeOptions.stock')}</option>
              <option value="consommable">{t('invoicing.stock.typeOptions.consommable')}</option>
              <option value="achat_ponctuel">{t('invoicing.stock.typeOptions.achat_ponctuel')}</option>
            </select>
          </label>
          <label>
            {t('invoicing.stock.category')}
            <select value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
              <option value="">{t('common.none')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nom}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('invoicing.stock.amountHT')}
            <input type="number" value={valeurAcquisitionHT} onChange={(e) => setValeurAcquisitionHT(Number(e.target.value))} />
          </label>
          <label>
            {t('invoicing.stock.tvaRate')}
            <input type="number" value={tauxTVA} onChange={(e) => setTauxTVA(Number(e.target.value))} />
          </label>
          <label>
            {t('invoicing.stock.acquisitionDate')}
            <input type="date" value={dateAcquisition} onChange={(e) => setDateAcquisition(e.target.value)} />
          </label>
          <label>
            {t('invoicing.stock.supplier')}
            <input value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} />
          </label>
          <label>
            {t('invoicing.stock.invoiceRef')}
            <input value={factureRef} onChange={(e) => setFactureRef(e.target.value)} />
          </label>
          <label>
            {t('invoicing.stock.reference')}
            <input value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>
          <label>
            {t('invoicing.stock.color')}
            <input type="color" value={couleur} onChange={(e) => setCouleur(e.target.value)} />
          </label>
          <label>
            {t('invoicing.stock.paymentMode')}
            <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value as ModePaiementAchat)}>
              <option value="virement">{t('invoicing.gestion.paymentMode.virement')}</option>
              <option value="cheque">{t('invoicing.gestion.paymentMode.cheque')}</option>
              <option value="especes">{t('invoicing.gestion.paymentMode.especes')}</option>
              <option value="cb">{t('invoicing.gestion.paymentMode.cb')}</option>
              <option value="prelevement">{t('invoicing.gestion.paymentMode.prelevement')}</option>
              <option value="autre">{t('invoicing.stock.other')}</option>
            </select>
          </label>
          {showDureeAmortissement && (
            <label>
              {t('invoicing.stock.depreciationYears')}
              <input
                type="number"
                min={0}
                value={dureeAmortissement}
                onChange={(e) => setDureeAmortissement(Number(e.target.value))}
              />
            </label>
          )}
          {showInventaireFields && (
            <>
              <label>
                {t('invoicing.stock.volumeType')}
                <select value={unite} onChange={(e) => setUnite(e.target.value)}>
                  {UNITES_MESURE.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('invoicing.stock.currentQty')}
                <input
                  type="number"
                  min={0}
                  value={quantite}
                  onChange={(e) => setQuantite(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
              <label>
                {t('invoicing.stock.nbElementsPerRef')}
                <input
                  type="number"
                  min={0}
                  value={nbElementsParRef}
                  onChange={(e) =>
                    setNbElementsParRef(e.target.value === '' ? '' : Number(e.target.value))
                  }
                />
              </label>
              <label>
                {t('invoicing.stock.need')}
                <input
                  type="number"
                  min={0}
                  value={besoin}
                  onChange={(e) => setBesoin(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
            </>
          )}
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
