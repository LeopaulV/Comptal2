import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { startOfYear, endOfYear } from 'date-fns';
import { Donateur, Don, DONATEUR_ANONYME_ID } from '../../types/Association';
import { DonateurService } from '../../services/DonateurService';
import { DonsService } from '../../services/DonsService';
import { DataService } from '../../services/DataService';
import { ConfigService } from '../../services/ConfigService';
import { AssociationPDFService } from '../../services/AssociationPDFService';
import { Transaction } from '../../types/Transaction';
import { CategoriesConfig } from '../../types/Category';
import { DonateurRow } from './DonateurRow';
import { DonateurModal } from './DonateurModal';
import { TransactionLinkDialog } from './TransactionLinkDialog';
import { DonNatureModal } from './DonNatureModal';
import { Package, Briefcase, Banknote, Plus, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/format';

interface GestionDonateursPanelProps {
  onDataChange?: () => void | Promise<void>;
}

const NATURE_ICON: Record<string, React.ReactNode> = {
  nature: <Package size={13} />,
  mecenat_competences: <Briefcase size={13} />,
  numeraire: <Banknote size={13} />,
};
const NATURE_LABEL: Record<string, string> = {
  nature: 'Nature',
  mecenat_competences: 'Mécénat',
  numeraire: 'Numéraire',
};

export const GestionDonateursPanel: React.FC<GestionDonateursPanelProps> = ({ onDataChange }) => {
  const { t } = useTranslation();
  const [donateurs, setDonateurs] = useState<Donateur[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<CategoriesConfig>({});
  const [transactionMapping, setTransactionMapping] = useState<Record<string, string>>({});
  const [donsParDonateur, setDonsParDonateur] = useState<Map<string, Don[]>>(new Map());
  const [donsAnonymes, setDonsAnonymes] = useState<Don[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDonateurModalOpen, setIsDonateurModalOpen] = useState(false);
  const [editingDonateur, setEditingDonateur] = useState<Donateur | null>(null);
  const [linkDonateur, setLinkDonateur] = useState<Donateur | null>(null);
  const [expandedDonateurId, setExpandedDonateurId] = useState<string | null>(null);
  const [pdfStartDate, setPdfStartDate] = useState(() => startOfYear(new Date()).toISOString().slice(0, 10));
  const [pdfEndDate, setPdfEndDate] = useState(() => endOfYear(new Date()).toISOString().slice(0, 10));
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [isGeneratingDeclaration, setIsGeneratingDeclaration] = useState(false);
  const [anonymeModalOpen, setAnonymeModalOpen] = useState(false);
  const [editingDonAnonyme, setEditingDonAnonyme] = useState<Don | null>(null);
  const [showAnonymes, setShowAnonymes] = useState(false);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const [loadedDonateurs, loadedTransactions, loadedMapping, loadedCategories, allDons] = await Promise.all([
        DonateurService.loadDonateurs(),
        DataService.getTransactions(),
        DonateurService.loadTransactionMapping(),
        ConfigService.loadCategories(),
        DonsService.loadDons(),
      ]);
      setDonateurs(loadedDonateurs);
      setTransactions(loadedTransactions);
      setTransactionMapping(loadedMapping);
      setCategories(loadedCategories);

      // Répartir les dons manuels par donateur
      const byDonateur = new Map<string, Don[]>();
      const anonymes: Don[] = [];
      for (const don of allDons) {
        if (don.donateurId === DONATEUR_ANONYME_ID) {
          anonymes.push(don);
        } else {
          if (!byDonateur.has(don.donateurId)) byDonateur.set(don.donateurId, []);
          byDonateur.get(don.donateurId)!.push(don);
        }
      }
      setDonsParDonateur(byDonateur);
      setDonsAnonymes(anonymes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

      await onDataChange?.();
    } catch (error) {
      console.error('Erreur chargement GestionDonateursPanel:', error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [onDataChange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const transactionsById = useMemo(() => {
    const map = new Map<string, Transaction>();
    transactions.forEach((t) => map.set(t.id, t));
    return map;
  }, [transactions]);

  const transactionsByDonateur = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const [txId, donateurId] of Object.entries(transactionMapping)) {
      const tx = transactionsById.get(txId);
      if (tx && tx.amount > 0) {
        if (!map.has(donateurId)) map.set(donateurId, []);
        map.get(donateurId)!.push(tx);
      }
    }
    return map;
  }, [transactionMapping, transactionsById]);

  const handleAddDonateur = () => {
    setEditingDonateur(null);
    setIsDonateurModalOpen(true);
  };

  const handleEditDonateur = (donateur: Donateur) => {
    setEditingDonateur(donateur);
    setIsDonateurModalOpen(true);
  };

  const closeDonateurModal = async () => {
    setIsDonateurModalOpen(false);
    setEditingDonateur(null);
    await loadData(false);
    toast.success(t('association.gestion.donateurSaved'));
  };

  const handleLinkTransaction = (donateur: Donateur) => {
    setLinkDonateur(donateur);
  };

  const closeLinkDialog = () => {
    setLinkDonateur(null);
  };

  const handleLinked = () => {
    loadData(false);
  };

  const handleGenerateRecapPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const start = new Date(pdfStartDate);
      const end = new Date(pdfEndDate);
      await AssociationPDFService.generateRecapPDF(start, end);
      toast.success(t('association.gestion.pdfGenerated'));
    } catch (error: any) {
      toast.error(error.message || t('association.gestion.pdfError'));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleGenerateBatchPdf = async () => {
    setIsGeneratingBatch(true);
    try {
      const start = new Date(pdfStartDate);
      const end = new Date(pdfEndDate);
      const count = await AssociationPDFService.generateDonateurPDFBatch(start, end);
      toast.success(t('association.gestion.batchPdfGenerated', { count }));
    } catch (error: any) {
      toast.error(error.message || t('association.gestion.pdfError'));
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  const handleGenerateDeclarationAnnuelle = async () => {
    const annee = new Date(pdfStartDate).getFullYear();
    setIsGeneratingDeclaration(true);
    try {
      await AssociationPDFService.generateDeclarationAnnuellePDF(annee);
      toast.success(t('association.gestion.declarationGenerated'));
    } catch (error: any) {
      toast.error(error.message || t('association.gestion.pdfError'));
    } finally {
      setIsGeneratingDeclaration(false);
    }
  };

  const handleDeleteDonAnonyme = async (don: Don) => {
    if (!window.confirm(t('association.dons.confirmDelete'))) return;
    await DonsService.deleteDon(don.id);
    toast.success(t('association.dons.deleted'));
    await loadData(false);
  };

  const totalAnonymes = useMemo(
    () => donsAnonymes.reduce((s, d) => s + d.montant, 0),
    [donsAnonymes]
  );

  return (
    <div className="association-panel">
      <div className="invoicing-card">
        <div className="invoicing-header-row">
          <h2>{t('association.gestion.title')}</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={pdfStartDate}
                onChange={(e) => setPdfStartDate(e.target.value)}
                className="association-input-date"
              />
              <span>-</span>
              <input
                type="date"
                value={pdfEndDate}
                onChange={(e) => setPdfEndDate(e.target.value)}
                className="association-input-date"
              />
            </div>
            <button
              type="button"
              className="secondary"
              onClick={handleGenerateRecapPdf}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? t('common.loading') : t('association.gestion.generatePdfRecap')}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleGenerateBatchPdf}
              disabled={isGeneratingBatch}
              title={t('association.gestion.batchPdfHint')}
            >
              {isGeneratingBatch ? t('common.loading') : t('association.gestion.generateBatchPdf')}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleGenerateDeclarationAnnuelle}
              disabled={isGeneratingDeclaration}
              title={t('association.gestion.declarationAnnuelleHint')}
            >
              {isGeneratingDeclaration ? t('common.loading') : t('association.gestion.declarationAnnuelle')}
            </button>
            <button type="button" className="primary" onClick={handleAddDonateur}>
              + {t('association.gestion.addDonateur')}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="invoicing-empty" style={{ padding: '40px', textAlign: 'center' }}>
            {t('common.loading')}
          </div>
        ) : (
          <div className="invoicing-list">
            {donateurs.map((donateur) => (
              <DonateurRow
                key={donateur.id}
                donateur={donateur}
                transactions={transactionsByDonateur.get(donateur.id) || []}
                dons={donsParDonateur.get(donateur.id) || []}
                categoryName={donateur.categoryCode ? categories[donateur.categoryCode]?.name : undefined}
                onEdit={handleEditDonateur}
                onLinkTransaction={handleLinkTransaction}
                onRefresh={loadData}
                defaultExpanded={donateur.id === expandedDonateurId}
                onExpanded={() => setExpandedDonateurId(null)}
              />
            ))}
            {donateurs.length === 0 && (
              <div className="invoicing-empty" style={{ padding: '40px', textAlign: 'center' }}>
                {t('association.gestion.empty')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section dons non identifiés */}
      <div className="invoicing-card don-anonyme-section">
        <div className="invoicing-header-row">
          <div>
            <h3 className="don-anonyme-title">{t('association.dons.anonymeTitle')}</h3>
            <p className="don-anonyme-subtitle">{t('association.dons.anonymeSubtitle')}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {donsAnonymes.length > 0 && (
              <span className="don-anonyme-total">
                {donsAnonymes.length} {t('association.dons.anonymeCount')} • {formatCurrency(totalAnonymes)}
              </span>
            )}
            <button
              type="button"
              className="secondary"
              onClick={() => setShowAnonymes((p) => !p)}
            >
              {showAnonymes ? t('association.dons.anonymeMasquer') : t('association.dons.anonymeAfficher')}
              {donsAnonymes.length > 0 && ` (${donsAnonymes.length})`}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => { setEditingDonAnonyme(null); setAnonymeModalOpen(true); }}
            >
              <Plus size={14} style={{ marginRight: 4 }} />
              {t('association.dons.anonymeAjouter')}
            </button>
          </div>
        </div>

        {showAnonymes && (
          <div className="invoicing-list" style={{ marginTop: 12 }}>
            {donsAnonymes.length === 0 ? (
              <div className="invoicing-empty" style={{ padding: 24, textAlign: 'center' }}>
                {t('association.dons.anonymeEmpty')}
              </div>
            ) : (
              donsAnonymes.map((don) => (
                <div key={don.id} className="invoicing-list-item don-manuel-item">
                  <span className="don-nature-badge" data-nature={don.natureDon}>
                    {NATURE_ICON[don.natureDon]}
                    {NATURE_LABEL[don.natureDon] || don.natureDon}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div className="name">
                      {don.donorLabel
                        ? <><strong>{don.donorLabel}</strong>{don.description ? ` — ${don.description}` : ''}</>
                        : don.description || t('association.dons.noDescription')}
                    </div>
                    {don.notes && <div className="meta">{don.notes}</div>}
                  </div>
                  <div className="meta">
                    {formatDate(don.date instanceof Date ? don.date : new Date(don.date))}
                    {don.datePerception && (
                      <span className="don-date-perception" title={t('association.dons.datePerception')}>
                        {' '}• {t('association.dons.percuLe')} {formatDate(don.datePerception instanceof Date ? don.datePerception : new Date(don.datePerception))}
                      </span>
                    )}
                  </div>
                  <div className="meta" style={{ color: 'var(--invoicing-primary)', fontWeight: 600, minWidth: 80, textAlign: 'right' }}>
                    {formatCurrency(don.montant)}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      className="don-action-btn"
                      onClick={() => { setEditingDonAnonyme(don); setAnonymeModalOpen(true); }}
                      title={t('common.edit')}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      className="don-action-btn don-action-btn--delete"
                      onClick={() => handleDeleteDonAnonyme(don)}
                      title={t('common.delete')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <DonateurModal
        isOpen={isDonateurModalOpen}
        donateurToEdit={editingDonateur}
        onClose={closeDonateurModal}
      />

      {linkDonateur && (
        <TransactionLinkDialog
          isOpen={!!linkDonateur}
          donateurId={linkDonateur.id}
          onClose={closeLinkDialog}
          onLinked={handleLinked}
        />
      )}

      <DonNatureModal
        isOpen={anonymeModalOpen}
        donateurId={DONATEUR_ANONYME_ID}
        donateurLabel={t('association.dons.anonymeLabel')}
        donToEdit={editingDonAnonyme}
        allowAnonymous
        onClose={() => { setAnonymeModalOpen(false); setEditingDonAnonyme(null); }}
        onSaved={async () => {
          setAnonymeModalOpen(false);
          setEditingDonAnonyme(null);
          await loadData(false);
          toast.success(t('association.dons.saved'));
          setShowAnonymes(true);
        }}
      />
    </div>
  );
};
