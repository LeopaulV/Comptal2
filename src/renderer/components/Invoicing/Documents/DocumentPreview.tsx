import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Devis, Facture } from '../../../types/Invoice';
import { InvoiceService } from '../../../services/InvoiceService';
import { PDFService } from '../../../services/PDFService';
import { EmetteurService } from '../../../services/EmetteurService';

interface DocumentPreviewProps {
  documentType: 'devis' | 'facture';
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ documentType }) => {
  const { t } = useTranslation();
  const [latestDevis, setLatestDevis] = useState<Devis | null>(null);
  const [latestFacture, setLatestFacture] = useState<Facture | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const devis = await InvoiceService.loadDevis();
      const factures = await InvoiceService.loadFactures();
      const devisActifs = devis.filter((d) => !d.supprime);
      const facturesActives = factures.filter((f) => !f.supprime);
      setLatestDevis(devisActifs[devisActifs.length - 1] || null);
      setLatestFacture(facturesActives[facturesActives.length - 1] || null);
    };
    load();
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      let emetteur = null;
      try {
        emetteur = await EmetteurService.loadEmetteurExtended();
      } catch {
        emetteur = null;
      }
      emetteur = emetteur ?? (await EmetteurService.loadEmetteur());
      if (!emetteur) return;
      if (documentType === 'devis' && latestDevis) {
        await PDFService.generateDevisPDF(latestDevis, emetteur);
      }
      if (documentType === 'facture' && latestFacture) {
        await PDFService.generateFacturePDF(latestFacture, emetteur);
      }
    } catch (error) {
      console.error('[DocumentPreview] Export PDF échoué:', error);
      toast.error(t('invoicing.documents.exportError', 'Erreur lors de la génération du PDF'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="invoicing-card">
      <h2>{t('invoicing.documents.previewTitle')}</h2>
      <div className="invoicing-preview-box">{t('invoicing.documents.previewPlaceholder')}</div>
      <button type="button" className="primary" onClick={handleExport} disabled={isExporting}>
        {isExporting ? t('invoicing.documents.exporting', 'Génération...') : t('invoicing.documents.exportPdf')}
      </button>
    </div>
  );
};
