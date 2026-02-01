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
  onAddFacture: () => void;
  onEditDevis: () => void;
  onDeleteFacture?: (facture: Facture) => void;
  onRefresh: () => Promise<void>;
}

export const DevisRow: React.FC<DevisRowProps> = ({ devis, factures, transactionsById, onAddFacture, onEditDevis, onDeleteFacture, onRefresh }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Calcul du ratio Factures Générées = [Somme TTC des factures] / [TTC du devis]
  const totalFacturesTTC = factures.reduce((sum, facture) => sum + (facture.totalTTC || 0), 0);
  const ratioFacturesGenerees = devis.totalTTC > 0 ? (totalFacturesTTC / devis.totalTTC) * 100 : 0;
  const ratioFacturesGenereesDisplay = Math.min(ratioFacturesGenerees, 100); // Plafonner à 100%

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
      <div className="invoicing-list-item invoicing-nested-item invoicing-devis-row">
        <ChevronToggle isOpen={isOpen} onClick={() => setIsOpen((prev) => !prev)} />
        <div className="invoicing-row-content">
        <div className="invoicing-row-name">
          {devis.numero}
          <span className="invoicing-row-meta">
            • {formatDate(devis.dateEmission)} • {formatCurrency(devis.totalTTC)}
          </span>
        </div>
        <div className="invoicing-recovery-container">
          <div className="invoicing-recovery-bar-wrapper">
            <div className="invoicing-recovery-bar">
              <div
                className="invoicing-recovery-progress"
                style={{ width: `${ratioFacturesGenereesDisplay}%` }}
              />
            </div>
            <span className="invoicing-recovery-label">
              {factures.length > 0
                ? `${formatCurrency(totalFacturesTTC)} / ${formatCurrency(devis.totalTTC)}`
                : t('invoicing.gestion.notConverted', 'Non converti')}
            </span>
          </div>
          <span className="invoicing-recovery-percent">{ratioFacturesGenereesDisplay.toFixed(0)}%</span>
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
            className="secondary"
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
              onDeleteFacture={onDeleteFacture ? () => onDeleteFacture(facture) : undefined}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
};
