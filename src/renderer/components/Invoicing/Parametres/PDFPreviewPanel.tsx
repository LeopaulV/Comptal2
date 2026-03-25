import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, ZoomIn, ZoomOut, RotateCcw, Loader, AlertCircle } from 'lucide-react';
import pdfMake from 'pdfmake/build/pdfmake';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { EmetteurExtended, PDFTemplate } from '../../../types/Invoice';
import { PDFTemplateService } from '../../../services/PDFTemplateService';
import { LegalMentionsService } from '../../../services/LegalMentionsService';

interface PDFPreviewPanelProps {
  emetteur: EmetteurExtended;
  activeDocumentType?: 'devis' | 'facture';
}

// Initialisation des fonts pdfmake
let fontsLoaded = false;
const loadFonts = async () => {
  if (fontsLoaded) return;
  try {
    const pdfFonts = await import('pdfmake/build/vfs_fonts');
    if (pdfFonts && (pdfFonts as any).default) {
      const fonts = (pdfFonts as any).default;
      if (fonts.pdfMake && fonts.pdfMake.vfs) {
        (pdfMake as any).vfs = fonts.pdfMake.vfs;
        fontsLoaded = true;
      } else if (fonts.vfs) {
        (pdfMake as any).vfs = fonts.vfs;
        fontsLoaded = true;
      }
    } else if ((pdfFonts as any).pdfMake && (pdfFonts as any).pdfMake.vfs) {
      (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
      fontsLoaded = true;
    }
  } catch (error) {
    console.warn('Impossible de charger les fonts pdfmake:', error);
  }
};

export const PDFPreviewPanel: React.FC<PDFPreviewPanelProps> = ({
  emetteur,
  activeDocumentType = 'devis',
}) => {
  const { t } = useTranslation();
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [activeTab, setActiveTab] = useState<'devis' | 'facture'>(activeDocumentType);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const formatCurrency = (value: number) => `${value.toFixed(2)} €`;

  const buildPreviewDocument = useCallback(
    async (docType: 'devis' | 'facture', template?: PDFTemplate): Promise<TDocumentDefinitions> => {
      // Récupérer les mentions légales sélectionnées (prédéfinies + personnalisées, avec placeholders)
      let mentionsText = '';
      if (emetteur.selectedMentionsLegales && emetteur.selectedMentionsLegales.length > 0) {
        mentionsText = await LegalMentionsService.generateMentionsText(
          emetteur.selectedMentionsLegales,
          emetteur.customMentionsLegales || [],
          emetteur.mentionPlaceholderValues || {}
        );
      }

      // Couleurs du template ou par défaut
      const colors = template?.colors || {
        primary: '#1e3a8a',
        secondary: '#475569',
        text: '#1f2937',
        border: '#e5e7eb',
      };

      const fontSize = template?.typography?.fontSize || {
        title: 18,
        header: 14,
        body: 10,
        footer: 8,
      };

      // Construire l'en-tête
      const headerContent: any[] = [
        { text: emetteur.denominationSociale || 'Nom de l\'entreprise', style: 'header' },
      ];

      if (emetteur.adresse?.rue) {
        headerContent.push({
          text: `${emetteur.adresse.rue}, ${emetteur.adresse.codePostal} ${emetteur.adresse.ville}`,
          style: 'subtext',
        });
      }

      if (emetteur.siret) {
        headerContent.push({ text: `SIRET: ${emetteur.siret}`, style: 'subtext' });
      }

      if (emetteur.numeroTVA) {
        headerContent.push({ text: `TVA: ${emetteur.numeroTVA}`, style: 'subtext' });
      } else if (emetteur.regimeTVA === 'franchise') {
        headerContent.push({ text: 'TVA non applicable', style: 'subtext' });
      }

      // Logo
      let headerSection: any;
      if (emetteur.logo) {
        const logoPosition = template?.layout?.logoPosition || 'left';
        if (logoPosition === 'center') {
          headerSection = [
            {
              image: emetteur.logo,
              width: template?.layout?.logoSize?.width || 120,
              alignment: 'center',
              margin: [0, 0, 0, 10],
            },
            { stack: headerContent, alignment: 'center' },
          ];
        } else if (logoPosition === 'right') {
          headerSection = {
            columns: [
              { stack: headerContent, alignment: 'left' },
              { image: emetteur.logo, width: template?.layout?.logoSize?.width || 120, alignment: 'right' },
            ],
            columnGap: 20,
          };
        } else {
          headerSection = {
            columns: [
              { image: emetteur.logo, width: template?.layout?.logoSize?.width || 120 },
              { stack: headerContent, alignment: 'right' },
            ],
            columnGap: 20,
          };
        }
      } else {
        headerSection = { stack: headerContent };
      }

      // Exemple de postes pour la prévisualisation (matériel + service)
      const samplePostes = [
        { designation: 'Fourniture matériel', qte: 15, unite: 'm²', prixHT: 10, tva: 20, coef: 1 },
        { designation: 'Prestation de service', qte: 8, unite: 'h (×2 interv.)', prixHT: 25, tva: 20, coef: 2 },
      ];

      const totalHT = samplePostes.reduce((sum, p) => sum + p.qte * p.prixHT * (p.coef || 1), 0);
      const totalTVA = samplePostes.reduce(
        (sum, p) => sum + (p.qte * p.prixHT * (p.coef || 1) * p.tva) / 100,
        0
      );
      const totalTTC = totalHT + totalTVA;

      // Convertir le format en majuscules pour pdfmake (LETTER au lieu de Letter)
      const pageSize = template?.format === 'Letter' ? 'LETTER' : (template?.format || 'A4');

      const docDefinition: TDocumentDefinitions = {
        pageSize,
        pageOrientation: template?.orientation || 'portrait',
        pageMargins: template?.layout?.margins
          ? [
              template.layout.margins.left,
              template.layout.margins.top,
              template.layout.margins.right,
              template.layout.margins.bottom,
            ]
          : [40, 40, 40, 40],
        content: [
          headerSection,
          { text: '\n' },
          {
            text: docType === 'devis' ? 'DEVIS N° DEVIS-2026-0001' : 'FACTURE N° FAC-2026-0001',
            style: 'title',
            color: colors.primary,
          },
          { text: `Date: ${new Date().toLocaleDateString('fr-FR')}`, style: 'date' },
          docType === 'devis'
            ? { text: `Validité: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')}`, style: 'date' }
            : null,
          { text: '\n' },
          { text: 'Client:', style: 'sectionTitle', color: colors.primary },
          { text: 'Client Exemple', style: 'clientName' },
          { text: '123 Rue du Client, 75001 Paris', style: 'subtext' },
          { text: '\n' },
          {
            table: {
              headerRows: 1,
              widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
              body: [
                [
                  { text: 'Désignation', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
                  { text: 'Qté', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
                  { text: 'Unité', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
                  { text: 'Prix U. HT', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
                  { text: 'TVA', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
                  { text: 'Total HT', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
                ],
                ...samplePostes.map((p) => [
                  p.designation,
                  { text: p.qte.toString(), alignment: 'right' as const },
                  { text: p.unite, alignment: 'center' as const },
                  { text: formatCurrency(p.prixHT), alignment: 'right' as const },
                  { text: `${p.tva}%`, alignment: 'right' as const },
                  {
                    text: formatCurrency(p.qte * p.prixHT * (p.coef || 1)),
                    alignment: 'right' as const,
                  },
                ]),
              ],
            },
            layout: {
              hLineWidth: (i: number, node: any) =>
                i === 0 || i === 1 || i === node.table.body.length ? 0.75 : 0.25,
              vLineWidth: () => 0.25,
              hLineColor: () => colors.border || '#e5e7eb',
              vLineColor: () => colors.border || '#e5e7eb',
              fillColor: (rowIndex: number) => {
                if (rowIndex === 0) return colors.primary;
                return rowIndex % 2 === 1 ? '#f8fafc' : null;
              },
            },
          },
          { text: '\n' },
          { text: `Total HT: ${formatCurrency(totalHT)}`, alignment: 'right', style: 'total' },
          { text: `Total TVA: ${formatCurrency(totalTVA)}`, alignment: 'right', style: 'subtotal' },
          {
            text: `Total TTC: ${formatCurrency(totalTTC)}`,
            alignment: 'right',
            style: 'grandTotal',
            color: colors.primary,
          },
          { text: '\n\n' },
          mentionsText ? { text: mentionsText, style: 'mentions' } : null,
          emetteur.coordonneesBancaires?.iban
            ? {
                text: `Coordonnées bancaires: IBAN ${emetteur.coordonneesBancaires.iban} - BIC ${emetteur.coordonneesBancaires.bic || ''}`,
                style: 'mentions',
              }
            : null,
        ].filter(Boolean),
        styles: {
          header: { fontSize: fontSize.title, bold: true, color: colors.primary },
          title: { fontSize: fontSize.header + 2, bold: true, margin: [0, 10, 0, 5] },
          sectionTitle: { fontSize: fontSize.header, bold: true, margin: [0, 5, 0, 3] },
          date: { fontSize: fontSize.body, color: colors.secondary },
          subtext: { fontSize: fontSize.body, color: colors.secondary },
          clientName: { fontSize: fontSize.body + 1, bold: true },
          tableHeader: { fontSize: fontSize.body, bold: true },
          total: { fontSize: fontSize.body, margin: [0, 2, 0, 2] },
          subtotal: { fontSize: fontSize.body, color: colors.secondary },
          grandTotal: { fontSize: fontSize.header, bold: true, margin: [0, 5, 0, 0] },
          mentions: { fontSize: fontSize.footer, color: colors.secondary, margin: [0, 2, 0, 2] },
        },
      };

      return docDefinition;
    },
    [emetteur]
  );

  const generatePreview = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      await loadFonts();

      // Charger le template sélectionné
      const templateId =
        activeTab === 'devis' ? emetteur.pdfTemplateDevis : emetteur.pdfTemplateFacture;
      let template: PDFTemplate | null = null;

      if (templateId) {
        template = await PDFTemplateService.getTemplateById(templateId);
      }

      if (!template) {
        const templates = await PDFTemplateService.loadTemplates();
        template = templates.find((t) => t.isDefault) || templates[0];
      }

      const docDefinition = await buildPreviewDocument(activeTab, template || undefined);
      const pdfDoc = pdfMake.createPdf(docDefinition);

      // pdfmake 0.3 : getDataUrl() retourne une Promise (les types TS sont obsolètes)
      const dataUrl = await (pdfDoc.getDataUrl as () => Promise<string>)();
      setPdfDataUrl(dataUrl);
    } catch (err: any) {
      console.error('Erreur lors de la génération du PDF:', err);
      setError(err.message || t('invoicing.preview.error'));
    } finally {
      setIsGenerating(false);
    }
  }, [activeTab, emetteur, buildPreviewDocument, t]);

  // Debounce la régénération du PDF
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      generatePreview();
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [emetteur, activeTab, generatePreview]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 50));
  const handleResetZoom = () => setZoom(100);

  return (
    <div className="pdf-preview-panel">
      {/* Header */}
      <div className="pdf-preview-header">
        <div className="pdf-preview-title">
          <FileText size={20} />
          <span>{t('invoicing.preview.title')}</span>
        </div>

        {/* Tabs */}
        <div className="pdf-preview-tabs">
          <button
            type="button"
            className={`pdf-preview-tab ${activeTab === 'devis' ? 'active' : ''}`}
            onClick={() => setActiveTab('devis')}
          >
            {t('invoicing.preview.devis')}
          </button>
          <button
            type="button"
            className={`pdf-preview-tab ${activeTab === 'facture' ? 'active' : ''}`}
            onClick={() => setActiveTab('facture')}
          >
            {t('invoicing.preview.facture')}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="pdf-preview-toolbar">
        <div className="pdf-preview-zoom-controls">
          <button
            type="button"
            className="pdf-preview-btn"
            onClick={handleZoomOut}
            disabled={zoom <= 50}
            title={t('invoicing.preview.zoomOut')}
          >
            <ZoomOut size={16} />
          </button>
          <span className="pdf-preview-zoom-value">{zoom}%</span>
          <button
            type="button"
            className="pdf-preview-btn"
            onClick={handleZoomIn}
            disabled={zoom >= 200}
            title={t('invoicing.preview.zoomIn')}
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            className="pdf-preview-btn"
            onClick={handleResetZoom}
            title={t('invoicing.preview.resetZoom')}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Preview content */}
      <div className="pdf-preview-content">
        {isGenerating ? (
          <div className="pdf-preview-loading">
            <Loader size={32} className="pdf-preview-spinner" />
            <span>{t('invoicing.preview.generating')}</span>
          </div>
        ) : error ? (
          <div className="pdf-preview-error">
            <AlertCircle size={32} />
            <span>{error}</span>
            <button type="button" className="pdf-preview-retry" onClick={generatePreview}>
              {t('invoicing.preview.retry')}
            </button>
          </div>
        ) : pdfDataUrl ? (
          <div
            className="pdf-preview-iframe-container"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          >
            <iframe
              src={pdfDataUrl}
              className="pdf-preview-iframe"
              title={t('invoicing.preview.title')}
            />
          </div>
        ) : (
          <div className="pdf-preview-empty">
            <FileText size={48} />
            <span>{t('invoicing.preview.empty')}</span>
          </div>
        )}
      </div>
    </div>
  );
};
