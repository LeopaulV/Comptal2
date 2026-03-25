import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, ZoomIn, ZoomOut, RotateCcw, Loader, AlertCircle } from 'lucide-react';
import pdfMake from 'pdfmake/build/pdfmake';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { PDFTemplate } from '../../types/Invoice';
import { AssociationConfig } from '../../types/Association';
import { PDFTemplateService } from '../../services/PDFTemplateService';

interface AssociationPDFPreviewPanelProps {
  config: AssociationConfig;
}

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

const formatAdresse = (a: { rue: string; codePostal: string; ville: string; pays: string }) =>
  [a.rue, `${a.codePostal} ${a.ville}`.trim(), a.pays].filter(Boolean).join(', ');

const formatCurrency = (value: number) => `${value.toFixed(2).replace('.', ',')} €`;

export const AssociationPDFPreviewPanel: React.FC<AssociationPDFPreviewPanelProps> = ({
  config,
}) => {
  const { t } = useTranslation();
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const buildPreviewDocument = useCallback(
    async (template?: PDFTemplate): Promise<TDocumentDefinitions> => {
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

      const textStack: any[] = [
        {
          text: config.denominationSociale || 'Nom de l\'association',
          style: 'header',
        },
      ];
      if (config.adresse && (config.adresse.rue || config.adresse.ville)) {
        textStack.push({ text: formatAdresse(config.adresse), style: 'subtext' });
      }
      if (config.rna) {
        textStack.push({ text: `RNA : ${config.rna}`, style: 'subtext' });
      }
      if (config.siren) {
        textStack.push({ text: `SIREN : ${config.siren}`, style: 'subtext' });
      }
      if (config.siret) {
        textStack.push({ text: `SIRET : ${config.siret}`, style: 'subtext' });
      }

      let headerSection: any;
      if (config.logo) {
        const logoWidth = template?.layout?.logoSize?.width || 120;
        const logoPosition = template?.layout?.logoPosition || 'left';
        if (logoPosition === 'center') {
          headerSection = [
            { image: config.logo, width: logoWidth, alignment: 'center', margin: [0, 0, 0, 10] },
            { stack: textStack, alignment: 'center' },
          ];
        } else if (logoPosition === 'right') {
          headerSection = {
            columns: [
              { stack: textStack, alignment: 'left' },
              { image: config.logo, width: logoWidth, alignment: 'right' },
            ],
            columnGap: 20,
          };
        } else {
          headerSection = {
            columns: [
              { image: config.logo, width: logoWidth },
              { stack: textStack, alignment: 'right' },
            ],
            columnGap: 20,
          };
        }
      } else {
        headerSection = { stack: textStack };
      }

      const sampleDons = [
        { donateur: 'Jean Dupont', date: '15/01/2026', desc: 'Don en numéraire', montant: 150 },
        { donateur: 'Jean Dupont', date: '10/03/2026', desc: 'Virement', montant: 200 },
        { donateur: 'Marie Martin', date: '22/02/2026', desc: 'Don en numéraire', montant: 500 },
        { donateur: 'Société ABC', date: '05/04/2026', desc: 'Mécénat', montant: 1000 },
      ];
      const total = sampleDons.reduce((sum, d) => sum + d.montant, 0);

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
          config.objetSocial
            ? { text: config.objetSocial, fontSize: fontSize.body, color: colors.secondary, margin: [0, 0, 0, 4] }
            : null,
          { text: 'RÉCAPITULATIF DES DONS', style: 'title', color: colors.primary },
          { text: `Période du 01/01/2026 au 31/12/2026`, style: 'date' },
          { text: '\n' },
          config.referencesCGI
            ? { text: config.referencesCGI, style: 'mentions' }
            : null,
          config.statutOIG
            ? { text: "Organisme d'intérêt général au sens des articles 200 et 238 bis du CGI.", style: 'mentions' }
            : null,
          { text: '\n' },
          {
            table: {
              headerRows: 1,
              widths: ['*', 'auto', '*', 'auto'],
              body: [
                [
                  { text: 'Donateur', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
                  { text: 'Date', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
                  { text: 'Description', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
                  { text: 'Montant', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff', alignment: 'right' },
                ],
                ...sampleDons.map((d) => [
                  d.donateur,
                  { text: d.date, fontSize: fontSize.body },
                  { text: d.desc, fontSize: fontSize.body },
                  { text: formatCurrency(d.montant), alignment: 'right' as const },
                ]),
                [
                  { text: 'TOTAL DES DONS', colSpan: 3, bold: true },
                  {},
                  {},
                  { text: formatCurrency(total), alignment: 'right' as const, bold: true },
                ],
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
          {
            text: "Attestation : Les dons listés ci-dessus n'ont donné lieu à aucune contrepartie.",
            style: 'mentions',
          },
          {
            text: `Document établi le ${new Date().toLocaleDateString('fr-FR')}`,
            style: 'mentions',
          },
        ].filter(Boolean),
        styles: {
          header: { fontSize: fontSize.title, bold: true, color: colors.primary },
          title: { fontSize: fontSize.header + 2, bold: true, margin: [0, 10, 0, 5] },
          sectionTitle: { fontSize: fontSize.header, bold: true, margin: [0, 5, 0, 3] },
          date: { fontSize: fontSize.body, color: colors.secondary },
          subtext: { fontSize: fontSize.body, color: colors.secondary },
          tableHeader: { fontSize: fontSize.body, bold: true },
          mentions: { fontSize: fontSize.footer, color: colors.secondary, margin: [0, 2, 0, 2] },
        },
        defaultStyle: {
          fontSize: fontSize.body,
          color: colors.text,
        },
      };

      return docDefinition;
    },
    [config]
  );

  const generatePreview = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      await loadFonts();

      let template: PDFTemplate | null = null;
      if (config.pdfTemplateRecuFiscal) {
        template = await PDFTemplateService.getTemplateById(config.pdfTemplateRecuFiscal);
      }
      if (!template) {
        const templates = await PDFTemplateService.loadTemplates();
        template = templates.find((tmpl) => tmpl.isDefault) || templates[0];
      }

      const docDefinition = await buildPreviewDocument(template || undefined);
      const pdfDoc = pdfMake.createPdf(docDefinition);

      const dataUrl = await (pdfDoc.getDataUrl as () => Promise<string>)();
      setPdfDataUrl(dataUrl);
    } catch (err: any) {
      console.error('Erreur lors de la génération du PDF:', err);
      setError(err.message || t('invoicing.preview.error'));
    } finally {
      setIsGenerating(false);
    }
  }, [config, buildPreviewDocument, t]);

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
  }, [config, generatePreview]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 50));
  const handleResetZoom = () => setZoom(100);

  return (
    <div className="pdf-preview-panel">
      <div className="pdf-preview-header">
        <div className="pdf-preview-title">
          <FileText size={20} />
          <span>{t('association.config.pdfPreviewTitle')}</span>
        </div>
      </div>

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
              title={t('association.config.pdfPreviewTitle')}
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
