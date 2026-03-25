import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { startOfYear, endOfYear } from 'date-fns';
import { Donateur, Don } from '../../types/Association';
import { Transaction } from '../../types/Transaction';
import { DonateurService } from '../../services/DonateurService';
import { DonsService } from '../../services/DonsService';
import { AssociationPDFService } from '../../services/AssociationPDFService';
import { DonNatureModal } from './DonNatureModal';
import { ChevronToggle } from '../Invoicing/Gestion/ChevronToggle';
import { formatCurrency, formatDate } from '../../utils/format';
import { Package, Briefcase, Banknote, Plus, Pencil, Trash2 } from 'lucide-react';

function formatAdresse(adresse: { rue: string; codePostal: string; ville: string; pays: string }): string {
  const parts = [adresse.rue, `${adresse.codePostal} ${adresse.ville}`.trim(), adresse.pays].filter(Boolean);
  return parts.join(', ');
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

interface DonateurRowProps {
  donateur: Donateur;
  transactions: Transaction[];
  dons: Don[];
  categoryName?: string;
  onEdit: (donateur: Donateur) => void;
  onLinkTransaction: (donateur: Donateur) => void;
  onRefresh: () => Promise<void>;
  defaultExpanded?: boolean;
  onExpanded?: () => void;
}

export const DonateurRow: React.FC<DonateurRowProps> = ({
  donateur,
  transactions,
  dons,
  categoryName,
  onEdit,
  onLinkTransaction,
  onRefresh,
  defaultExpanded = false,
  onExpanded,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [showPdfPanel, setShowPdfPanel] = useState(false);
  const [pdfStart, setPdfStart] = useState(() => startOfYear(new Date()).toISOString().slice(0, 10));
  const [pdfEnd, setPdfEnd] = useState(() => endOfYear(new Date()).toISOString().slice(0, 10));
  const [isGenerating, setIsGenerating] = useState(false);
  const [donModalOpen, setDonModalOpen] = useState(false);
  const [editingDon, setEditingDon] = useState<Don | null>(null);

  useEffect(() => {
    if (defaultExpanded) {
      setIsOpen(true);
      onExpanded?.();
    }
  }, [defaultExpanded, onExpanded]);

  const label = donateur.denominationSociale || `${donateur.prenom || ''} ${donateur.nom || ''}`.trim() || t('association.gestion.unknownDonateur');
  const formattedAdresse = formatAdresse(donateur.adresse);

  const totalTransactions = useMemo(
    () => transactions.filter((tx) => tx.amount > 0).reduce((s, tx) => s + tx.amount, 0),
    [transactions]
  );
  const totalDonsNature = useMemo(
    () => dons.reduce((s, d) => s + d.montant, 0),
    [dons]
  );
  const totalGlobal = totalTransactions + totalDonsNature;

  const handleGeneratePdf = async () => {
    setIsGenerating(true);
    try {
      await AssociationPDFService.generateDonateurPDF(donateur, new Date(pdfStart), new Date(pdfEnd));
      toast.success(t('association.gestion.donateurPdfGenerated'));
    } catch (error: any) {
      toast.error(error.message || t('association.gestion.pdfError'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('association.gestion.deleteDonateurConfirm'))) return;
    await DonateurService.deleteDonateur(donateur.id);
    await DonsService.deleteDonsByDonateur(donateur.id);
    toast.success(t('association.gestion.donateurDeleted'));
    await onRefresh();
  };

  const handleDeleteDon = async (don: Don) => {
    if (!window.confirm(t('association.dons.confirmDelete'))) return;
    await DonsService.deleteDon(don.id);
    toast.success(t('association.dons.deleted'));
    await onRefresh();
  };

  const handleEditDon = (don: Don) => {
    setEditingDon(don);
    setDonModalOpen(true);
  };

  const handleDonSaved = async () => {
    setEditingDon(null);
    setDonModalOpen(false);
    await onRefresh();
    toast.success(t('association.dons.saved'));
  };

  const sortedDons = useMemo(
    () => [...dons].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [dons]
  );

  return (
    <>
      <div className="invoicing-nested">
        <div className="invoicing-list-item">
          <ChevronToggle isOpen={isOpen} onClick={() => setIsOpen((prev) => !prev)} />
          <div className="invoicing-row-content invoicing-client-info">
            <div className="invoicing-client-main">
              <div className="invoicing-client-name">{label}</div>
              {(donateur.telephone || donateur.email || formattedAdresse) && (
                <div className="invoicing-client-details">
                  {donateur.telephone && <span>{donateur.telephone}</span>}
                  {donateur.email && <span>{donateur.email}</span>}
                  {formattedAdresse && <span>{formattedAdresse}</span>}
                </div>
              )}
            </div>
            <div className="invoicing-client-badges">
              {categoryName && (
                <span className="invoicing-client-badge devis" title={t('association.gestion.category')}>
                  {categoryName}
                </span>
              )}
              <span className="invoicing-client-badge factures">
                {transactions.length} {t('association.gestion.transactions')}
              </span>
              {dons.length > 0 && (
                <span className="invoicing-client-badge" style={{ background: 'var(--invoicing-primary)', color: 'white' }}>
                  {dons.length} {t('association.dons.badgeCount')}
                </span>
              )}
              <span className="invoicing-client-badge" style={{ background: 'var(--invoicing-success)', color: 'white' }}>
                {formatCurrency(totalGlobal)}
              </span>
            </div>
          </div>
          <div className="invoicing-list-item-actions">
            <button type="button" className="secondary" onClick={() => onEdit(donateur)}>
              {t('common.edit')}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setShowPdfPanel((prev) => !prev)}
            >
              {t('association.gestion.generateDonateurPdf')}
            </button>
            <button type="button" className="primary" onClick={() => onLinkTransaction(donateur)}>
              {t('association.gestion.linkTransaction')}
            </button>
            <button
              type="button"
              className="secondary don-add-btn"
              onClick={() => { setEditingDon(null); setDonModalOpen(true); }}
              title={t('association.dons.addTitle')}
            >
              <Plus size={14} />
              {t('association.dons.addBtn')}
            </button>
            <button
              type="button"
              className="secondary danger"
              style={{ color: 'var(--invoicing-danger, #dc2626)' }}
              onClick={handleDelete}
            >
              {t('association.gestion.deleteDonateur')}
            </button>
          </div>
        </div>

        {showPdfPanel && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              padding: '8px 16px 8px 44px',
              background: 'var(--invoicing-gray-50)',
              borderBottom: '1px solid var(--invoicing-gray-200)',
              fontSize: 13,
            }}
          >
            <input type="date" value={pdfStart} onChange={(e) => setPdfStart(e.target.value)} className="association-input-date" />
            <span>—</span>
            <input type="date" value={pdfEnd} onChange={(e) => setPdfEnd(e.target.value)} className="association-input-date" />
            <button type="button" className="primary" style={{ padding: '4px 12px', fontSize: 12 }} onClick={handleGeneratePdf} disabled={isGenerating}>
              {isGenerating ? t('common.loading') : t('association.gestion.generateDonateurPdf')}
            </button>
          </div>
        )}

        {isOpen && (
          <div className="invoicing-nested-content">
            {/* Transactions bancaires */}
            {transactions.filter((tx) => tx.amount > 0).length > 0 && (
              <div className="invoicing-subsection">
                <div className="don-section-label">{t('association.dons.sectionTransactions')}</div>
                {transactions
                  .filter((tx) => tx.amount > 0)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((tx) => (
                    <div key={tx.id} className="invoicing-list-item invoicing-nested-item">
                      <div className="name">{tx.description || t('invoicing.gestion.noDescription')}</div>
                      <div className="meta">{formatDate(tx.date)} • {tx.accountCode}</div>
                      <div className="meta" style={{ color: 'var(--invoicing-success)', fontWeight: 600 }}>
                        {formatCurrency(tx.amount)}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Dons manuels */}
            {sortedDons.length > 0 && (
              <div className="invoicing-subsection">
                <div className="don-section-label">{t('association.dons.sectionDons')}</div>
                {sortedDons.map((don) => (
                  <div key={don.id} className="invoicing-list-item invoicing-nested-item don-manuel-item">
                    <span className="don-nature-badge" data-nature={don.natureDon}>
                      {NATURE_ICON[don.natureDon]}
                      {NATURE_LABEL[don.natureDon] || don.natureDon}
                    </span>
                    <div className="name" style={{ flex: 1 }}>
                      {don.description || t('association.dons.noDescription')}
                    </div>
                    <div className="meta">
                      {formatDate(don.date instanceof Date ? don.date : new Date(don.date))}
                      {don.datePerception && (
                        <span className="don-date-perception" title={t('association.dons.datePerception')}>
                          {' '}• {t('association.dons.percuLe')} {formatDate(don.datePerception instanceof Date ? don.datePerception : new Date(don.datePerception))}
                        </span>
                      )}
                    </div>
                    <div className="meta" style={{ color: 'var(--invoicing-primary)', fontWeight: 600 }}>
                      {formatCurrency(don.montant)}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        className="don-action-btn"
                        onClick={() => handleEditDon(don)}
                        title={t('common.edit')}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className="don-action-btn don-action-btn--delete"
                        onClick={() => handleDeleteDon(don)}
                        title={t('common.delete')}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {transactions.filter((tx) => tx.amount > 0).length === 0 && dons.length === 0 && (
              <div className="invoicing-empty">{t('association.gestion.emptyTransactions')}</div>
            )}
          </div>
        )}
      </div>

      <DonNatureModal
        isOpen={donModalOpen}
        donateurId={donateur.id}
        donateurLabel={label}
        donToEdit={editingDon}
        onClose={() => { setDonModalOpen(false); setEditingDon(null); }}
        onSaved={handleDonSaved}
      />
    </>
  );
};
