import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, FileText, LoaderCircle, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmetteurExtended, PDFTemplate } from '../../types/invoice';
import { AssociationPDFService } from '../../services/AssociationPDFService';
import { PDFService } from '../../services/PDFService';
import { Logger } from '../../services/logger';

interface PdfPreviewPanelProps {
  documentType: 'devis' | 'facture' | 'receipt';
  emetteur?: EmetteurExtended;
  template?: PDFTemplate;
}

const PdfPreviewPanel: React.FC<PdfPreviewPanelProps> = ({ documentType, emetteur, template }) => {
  const { t } = useTranslation();
  const [dataUrl, setDataUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(80);
  const generation = useRef(0);

  useEffect(() => {
    if (!template) return;
    const currentGeneration = ++generation.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      void (documentType === 'receipt'
        ? AssociationPDFService.generatePreviewDataUrl(template)
        : emetteur
          ? PDFService.generateInvoicePreviewDataUrl(documentType, emetteur, template)
          : Promise.reject(new Error(t('org.previewError')))
      )
        .then((url) => {
          if (generation.current === currentGeneration) setDataUrl(url);
        })
        .catch((err) => {
          Logger.error('PdfPreviewPanel.generate', err);
          if (generation.current === currentGeneration) {
            setError(err instanceof Error ? err.message : t('org.previewError'));
          }
        })
        .finally(() => {
          if (generation.current === currentGeneration) setLoading(false);
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [documentType, emetteur, template, t]);

  return (
    <aside className="pdf-live-preview">
      <header className="pdf-live-preview-header">
        <div>
          <span className="pdf-live-preview-eyebrow">{t('org.livePreview')}</span>
          <h3>
            <FileText size={18} />
            {documentType === 'receipt'
              ? t('org.previewRecu')
              : documentType === 'devis'
                ? t('org.previewQuote')
                : t('org.previewInvoice')}
          </h3>
        </div>
        <div className="pdf-zoom-controls">
          <button type="button" onClick={() => setZoom((value) => Math.max(50, value - 10))} disabled={zoom <= 50}>
            <ZoomOut size={15} />
          </button>
          <span>{zoom}%</span>
          <button type="button" onClick={() => setZoom((value) => Math.min(140, value + 10))} disabled={zoom >= 140}>
            <ZoomIn size={15} />
          </button>
          <button type="button" onClick={() => setZoom(80)} title={t('org.resetZoom')}>
            <RotateCcw size={15} />
          </button>
        </div>
      </header>
      <div className="pdf-live-preview-stage">
        {loading && (
          <div className="pdf-preview-state">
            <LoaderCircle className="pdf-preview-spinner" size={28} />
            <span>{t('org.previewGenerating')}</span>
          </div>
        )}
        {!loading && error && (
          <div className="pdf-preview-state is-error">
            <AlertCircle size={28} />
            <span>{error}</span>
          </div>
        )}
        {!loading && !error && dataUrl && (
          <div className="pdf-preview-frame-wrap" style={{ width: `${zoom}%` }}>
            <iframe className="pdf-preview-frame" src={dataUrl} title={t('org.livePreview')} />
          </div>
        )}
      </div>
    </aside>
  );
};

export default PdfPreviewPanel;
