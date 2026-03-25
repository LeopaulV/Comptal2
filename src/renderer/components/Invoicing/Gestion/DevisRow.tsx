import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Devis, Facture } from '../../../types/Invoice';
import { Transaction } from '../../../types/Transaction';
import { formatCurrency, formatDate } from '../../../utils/format';
import { FactureRow } from './FactureRow';
import { ChevronToggle } from './ChevronToggle';
import { InvoiceService } from '../../../services/InvoiceService';
import { PDFService } from '../../../services/PDFService';
import { EmetteurService } from '../../../services/EmetteurService';

interface DevisRowProps {
  devis: Devis;
  factures: Facture[];
  transactionsById: Map<string, Transaction>;
  clientName: string;
  onAddFacture: () => void;
  onEditDevis: () => void;
  onDeleteFacture?: (facture: Facture) => void;
  onRefresh: () => Promise<void>;
}

export const DevisRow: React.FC<DevisRowProps> = ({ devis, factures, transactionsById, clientName, onAddFacture, onEditDevis, onDeleteFacture, onRefresh }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Taux de complétion = [Somme des paiements (transactions)] / [TTC du devis]
  const totalPaid = factures.reduce(
    (sum, facture) => sum + facture.paiements.reduce((s, p) => s + p.montant, 0),
    0
  );
  const completionRate = devis.totalTTC > 0 ? (totalPaid / devis.totalTTC) * 100 : 0;
  const completionRateDisplay = Math.min(completionRate, 100); // Plafonner à 100%

  const devisCompletionClass =
    completionRate >= 100 ? 'invoicing-devis-complet' : completionRate > 0 ? 'invoicing-devis-partiel' : 'invoicing-devis-0';

  const postesTitles = devis.postes.map((p) => p.designation).filter(Boolean).join(', ');
  const marges = devis.postes
    .map((p) => (p as { marge?: number }).marge)
    .filter((m): m is number => m != null && !Number.isNaN(m));
  const tauxMarge = marges.length > 0 ? (marges.reduce((a, b) => a + b, 0) / marges.length).toFixed(1) : null;

  const handleLinkPdf = async () => {
    setIsLinking(true);
    try {
      const result = await window.electronAPI.selectFile({
        filters: [{ name: 'Documents', extensions: ['pdf'] }],
      });
      if (!result.success || !result.path) {
        return;
      }
      const fileName = result.path.split(/[/\\]/).pop() || result.path;
      const devisList = await InvoiceService.loadDevis();
      const index = devisList.findIndex((item) => item.id === devis.id);
      if (index === -1) {
        return;
      }
      devisList[index] = {
        ...devisList[index],
        attachment: {
          mode: 'link',
          path: result.path,
          name: fileName,
        },
        updatedAt: new Date(),
      };
      await InvoiceService.saveDevis(devisList);
      await onRefresh();
    } finally {
      setIsLinking(false);
    }
  };

  const handleDeleteDevis = async () => {
    try {
      await InvoiceService.softDeleteDevis(devis.id);
      await onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      let emetteur = null;
      try {
        emetteur = await EmetteurService.loadEmetteurExtended();
      } catch {
        emetteur = null;
      }
      emetteur = emetteur ?? (await EmetteurService.loadEmetteur());
      if (!emetteur) {
        return;
      }
      await PDFService.generateDevisPDF(devis, emetteur);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="invoicing-nested">
      <div className={`invoicing-list-item invoicing-nested-item invoicing-devis-row ${devisCompletionClass}`}>
        <ChevronToggle isOpen={isOpen} onClick={() => setIsOpen((prev) => !prev)} />
        <div className="invoicing-row-content">
          <div className="invoicing-row-main">
            <div className="invoicing-row-name">
              {devis.numero}
              {devis.intituleSecondaire && (
                <span className="invoicing-row-intitule"> • {devis.intituleSecondaire}</span>
              )}
              <span className="invoicing-row-meta">
                • {formatDate(devis.dateEmission)} • {formatCurrency(devis.totalTTC)}
              </span>
            </div>
            {(devis.dateEcheance || postesTitles || tauxMarge) && (
              <div className="invoicing-row-extra-inline">
                {devis.dateEcheance && (
                  <span>
                    {t('invoicing.gestion.dateEcheance')}: {formatDate(devis.dateEcheance)}
                  </span>
                )}
                {postesTitles && (
                  <span title={postesTitles}>
                    {t('invoicing.gestion.postes')}: {postesTitles.length > 40 ? `${postesTitles.slice(0, 40)}…` : postesTitles}
                  </span>
                )}
                {tauxMarge != null && (
                  <span>
                    {t('invoicing.gestion.tauxMarge')}: {tauxMarge}%
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="invoicing-recovery-container">
          <div className="invoicing-recovery-bar-wrapper">
            <div className="invoicing-recovery-bar">
            <div
              className="invoicing-recovery-progress"
              style={{ width: `${completionRateDisplay}%` }}
            />
            </div>
            <span className="invoicing-recovery-label">
              {devis.totalTTC > 0
                ? `${formatCurrency(totalPaid)} / ${formatCurrency(devis.totalTTC)}`
                : t('invoicing.gestion.notConverted', 'Non converti')}
            </span>
          </div>
          <span className="invoicing-recovery-percent">{completionRateDisplay.toFixed(0)}%</span>
        </div>
        </div>
        <div className="invoicing-list-item-actions">
          <button type="button" className="secondary" onClick={onAddFacture}>
            {t('invoicing.gestion.addFacture')}
          </button>
          <button type="button" className="secondary" onClick={handleGeneratePdf} disabled={isGeneratingPdf}>
            {t('invoicing.gestion.generatePdf')}
          </button>
          <button type="button" className="secondary" onClick={handleLinkPdf} disabled={isLinking}>
            {t('invoicing.gestion.linkPdf')}
          </button>
          <button type="button" className="secondary" onClick={onEditDevis}>
            {t('invoicing.gestion.editDevis', 'Modifier')}
          </button>
          <button
            type="button"
            className="secondary danger"
            onClick={handleDeleteDevis}
            title={t('invoicing.gestion.archiveDevis', 'Archiver (reste dans le système)')}
          >
            {t('invoicing.gestion.deleteDevis', 'Supprimer')}
          </button>
        </div>
      </div>
      {devis.attachment?.name && (
        <div className="invoicing-inline-meta invoicing-pdf-link-row">
          <span>{t('invoicing.gestion.linkedPdf')}: {devis.attachment.name}</span>
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              const appPath = await window.electronAPI.getAppPath();
              const p = devis.attachment!.path;
              const isAbsolute = p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p);
              const fullPath = isAbsolute ? p : `${appPath}/${p}`.replace(/\/+/g, '/');
              await window.electronAPI.openPath(fullPath);
            }}
          >
            {t('invoicing.gestion.openPdf', 'Ouvrir le PDF')}
          </button>
        </div>
      )}
      {isOpen && (
        <div className="invoicing-nested-content">
          {factures.length === 0 && <div className="invoicing-empty">{t('invoicing.gestion.emptyFactures')}</div>}
          {factures.map((facture) => (
            <FactureRow
              key={facture.id}
              facture={facture}
              transactionsById={transactionsById}
              clientName={clientName}
              onDeleteFacture={onDeleteFacture ? () => onDeleteFacture(facture) : undefined}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
};
