import React, { useEffect, useRef, useState } from 'react';
import { Check, FileText, LayoutTemplate, Palette, RotateCcw, Type } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { EmetteurExtended, MentionLegale, PDFTemplate } from '../../types/invoice';
import { defaultEmetteur, EmetteurService } from '../../services/EmetteurService';
import { LegalMentionsService } from '../../services/LegalMentionsService';
import { DEFAULT_PDF_TEMPLATES, PDFTemplateService } from '../../services/PDFTemplateService';
import { AssociationConfigService } from '../../services/AssociationConfigService';
import { Logger } from '../../services/logger';
import PdfPreviewPanel from './PdfPreviewPanel';

interface PdfDocumentsPanelProps {
  mode: 'invoices' | 'receipts';
}

type InvoiceDocumentType = 'devis' | 'facture';

const colorKeys = ['primary', 'secondary', 'accent', 'text', 'border'] as const;

const PdfDocumentsPanel: React.FC<PdfDocumentsPanelProps> = ({ mode }) => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<PDFTemplate[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [documentType, setDocumentType] = useState<InvoiceDocumentType>('devis');
  const [emetteur, setEmetteur] = useState<EmetteurExtended>(defaultEmetteur());
  const [mentions, setMentions] = useState<MentionLegale[]>([]);
  const [newMention, setNewMention] = useState('');
  const [saving, setSaving] = useState(false);
  const templateSaveQueue = useRef<Promise<void>>(Promise.resolve());

  const selected = templates.find((template) => template.id === selectedId) ?? templates[0];

  useEffect(() => {
    void (async () => {
      try {
        const loadedTemplates = await PDFTemplateService.loadTemplates();
        setTemplates(loadedTemplates);
        if (mode === 'invoices') {
          const loaded = (await EmetteurService.loadEmetteurExtended()) ?? defaultEmetteur();
          const fallback = loadedTemplates[0]?.id ?? '';
          setEmetteur({
            ...loaded,
            pdfTemplateDevis: loaded.pdfTemplateDevis || fallback,
            pdfTemplateFacture: loaded.pdfTemplateFacture || fallback,
          });
          setSelectedId(loaded.pdfTemplateDevis || fallback);
          setMentions(await LegalMentionsService.loadMentions());
        } else {
          const config = await AssociationConfigService.getOrCreateConfig();
          setSelectedId(config.pdfTemplateRecuFiscal || loadedTemplates[0]?.id || '');
        }
      } catch (err) {
        Logger.error('PdfDocumentsPanel.load', err);
      }
    })();
  }, [mode]);

  const selectDocumentType = (type: InvoiceDocumentType) => {
    setDocumentType(type);
    setSelectedId(
      (type === 'devis' ? emetteur.pdfTemplateDevis : emetteur.pdfTemplateFacture) ||
        templates[0]?.id ||
        ''
    );
  };

  const selectTemplate = (id: string) => {
    setSelectedId(id);
    if (mode === 'invoices') {
      setEmetteur((current) => ({
        ...current,
        ...(documentType === 'devis' ? { pdfTemplateDevis: id } : { pdfTemplateFacture: id }),
      }));
    }
  };

  const updateTemplate = async (patch: Partial<PDFTemplate>) => {
    if (!selected) return;
    const next: PDFTemplate = {
      ...selected,
      ...patch,
      typography: patch.typography ?? selected.typography,
      colors: patch.colors ?? selected.colors,
      layout: patch.layout ?? selected.layout,
      isDefault: false,
    };
    setTemplates((current) => current.map((template) => (template.id === next.id ? next : template)));
    templateSaveQueue.current = templateSaveQueue.current
      .then(() => PDFTemplateService.saveCustomTemplate(next))
      .catch((err) => {
        Logger.error('PdfDocumentsPanel.updateTemplate', err);
        toast.error(t('common.error'));
      });
    await templateSaveQueue.current;
  };

  const resetTemplate = async () => {
    if (!selected) return;
    const original = DEFAULT_PDF_TEMPLATES.find((template) => template.id === selected.id);
    if (!original) return;
    const restored = structuredClone(original);
    setTemplates((current) =>
      current.map((template) => (template.id === restored.id ? restored : template))
    );
    templateSaveQueue.current = templateSaveQueue.current.then(() =>
      PDFTemplateService.saveCustomTemplate(restored)
    );
    await templateSaveQueue.current;
  };

  const saveSelection = async () => {
    setSaving(true);
    try {
      await templateSaveQueue.current;
      if (mode === 'invoices') {
        await EmetteurService.saveEmetteurExtended(emetteur);
      } else {
        const config = await AssociationConfigService.getOrCreateConfig();
        await AssociationConfigService.saveConfig({ ...config, pdfTemplateRecuFiscal: selectedId });
      }
      toast.success(t('org.saved'));
    } catch (err) {
      Logger.error('PdfDocumentsPanel.save', err);
      toast.error(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const isMentionSelected = (id: string) =>
    emetteur.selectedMentionsLegales?.includes(id) ?? false;

  const toggleMention = async (id: string, enabled: boolean) => {
    await LegalMentionsService.toggleMention(id, enabled);
    const current = emetteur.selectedMentionsLegales ?? [];
    setEmetteur({
      ...emetteur,
      selectedMentionsLegales: enabled
        ? Array.from(new Set([...current, id]))
        : current.filter((mentionId) => mentionId !== id),
    });
    setMentions(await LegalMentionsService.loadMentions());
  };

  const setPlaceholderValue = (mentionId: string, key: string, value: string) => {
    setEmetteur((current) => ({
      ...current,
      mentionPlaceholderValues: {
        ...(current.mentionPlaceholderValues ?? {}),
        [mentionId]: {
          ...(current.mentionPlaceholderValues?.[mentionId] ?? {}),
          [key]: value,
        },
      },
    }));
  };

  const addCustomMention = async () => {
    if (!newMention.trim()) return;
    const mention = {
      id: '',
      type: 'custom' as const,
      label: t('org.customMention'),
      content: newMention.trim(),
      category: 'autre' as const,
      enabled: true,
    };
    const created = await LegalMentionsService.saveCustomMention(mention);
    setNewMention('');
    setMentions(await LegalMentionsService.loadMentions());
    setEmetteur((current) => ({
      ...current,
      selectedMentionsLegales: Array.from(
        new Set([...(current.selectedMentionsLegales ?? []), created.id])
      ),
    }));
  };

  return (
    <div className="pdf-config-layout">
      <section className="pdf-config-panel">
        <header className="org-panel-heading">
          <span className="org-panel-icon"><Palette size={19} /></span>
          <div>
            <h2>{mode === 'invoices' ? t('org.pdfAppearance') : t('org.pdfReceipts')}</h2>
            <p>{t('org.pdfAppearanceHint')}</p>
          </div>
        </header>

        {mode === 'invoices' && (
          <div className="pdf-document-switch" role="tablist">
            {(['devis', 'facture'] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={documentType === type ? 'active' : ''}
                onClick={() => selectDocumentType(type)}
              >
                <FileText size={16} />
                {type === 'devis' ? t('org.quote') : t('org.invoice')}
              </button>
            ))}
          </div>
        )}

        <div className="pdf-settings-section">
          <div className="pdf-settings-title">
            <LayoutTemplate size={17} />
            <div>
              <h3>{t('org.chooseTemplate')}</h3>
              <p>{t('org.chooseTemplateHint')}</p>
            </div>
          </div>
          <div className="pdf-template-grid">
            {templates.map((template) => (
              <button
                type="button"
                key={template.id}
                className={`pdf-template-card ${selected?.id === template.id ? 'selected' : ''}`}
                onClick={() => selectTemplate(template.id)}
              >
                <span className="pdf-template-miniature" style={{ borderColor: template.colors.border }}>
                  <i style={{ backgroundColor: template.colors.primary }} />
                  <b style={{ color: template.colors.primary }} />
                  <em style={{ backgroundColor: template.colors.accent }} />
                </span>
                <span>
                  <strong>{template.name}</strong>
                  <small>{template.description}</small>
                </span>
                {selected?.id === template.id && <Check className="pdf-template-check" size={16} />}
              </button>
            ))}
          </div>
        </div>

        {selected && (
          <>
            <div className="pdf-settings-section">
              <div className="pdf-settings-title">
                <Palette size={17} />
                <div>
                  <h3>{t('org.colors')}</h3>
                  <p>{t('org.colorsHint')}</p>
                </div>
              </div>
              <div className="pdf-color-grid">
                {colorKeys.map((key) => (
                  <label key={key} className="pdf-color-field">
                    <input
                      type="color"
                      value={selected.colors[key]}
                      onChange={(event) =>
                        void updateTemplate({
                          colors: { ...selected.colors, [key]: event.target.value },
                        })
                      }
                    />
                    <span>{t(`org.color_${key}`)}</span>
                    <code>{selected.colors[key].toUpperCase()}</code>
                  </label>
                ))}
              </div>
            </div>

            <div className="pdf-settings-section">
              <div className="pdf-settings-title">
                <Type size={17} />
                <div>
                  <h3>{t('org.layoutAndType')}</h3>
                  <p>{t('org.layoutAndTypeHint')}</p>
                </div>
              </div>
              <div className="org-grid">
                <label className="org-field">
                  <span>{t('org.orientation')}</span>
                  <select
                    value={selected.orientation}
                    onChange={(event) =>
                      void updateTemplate({
                        orientation: event.target.value as PDFTemplate['orientation'],
                      })
                    }
                  >
                    <option value="portrait">{t('org.portrait')}</option>
                    <option value="landscape">{t('org.landscape')}</option>
                  </select>
                </label>
                <label className="org-field">
                  <span>{t('org.logoPosition')}</span>
                  <select
                    value={selected.layout.logoPosition}
                    onChange={(event) =>
                      void updateTemplate({
                        layout: {
                          ...selected.layout,
                          logoPosition: event.target.value as PDFTemplate['layout']['logoPosition'],
                        },
                      })
                    }
                  >
                    <option value="left">{t('org.left')}</option>
                    <option value="center">{t('org.center')}</option>
                    <option value="right">{t('org.right')}</option>
                  </select>
                </label>
                <label className="org-field">
                  <span>{t('org.bodySize')}</span>
                  <input
                    type="number"
                    min="8"
                    max="14"
                    value={selected.typography.fontSize.body}
                    onChange={(event) =>
                      void updateTemplate({
                        typography: {
                          ...selected.typography,
                          fontSize: {
                            ...selected.typography.fontSize,
                            body: Number(event.target.value),
                          },
                        },
                      })
                    }
                  />
                </label>
                <label className="org-field">
                  <span>{t('org.logoSize')}</span>
                  <input
                    type="range"
                    min="60"
                    max="180"
                    step="10"
                    value={selected.layout.logoSize.width}
                    onChange={(event) =>
                      void updateTemplate({
                        layout: {
                          ...selected.layout,
                          logoSize: {
                            ...selected.layout.logoSize,
                            width: Number(event.target.value),
                          },
                        },
                      })
                    }
                  />
                  <small>{selected.layout.logoSize.width} pt</small>
                </label>
              </div>
              <button type="button" className="pdf-reset-button" onClick={() => void resetTemplate()}>
                <RotateCcw size={15} />
                {t('org.resetStyle')}
              </button>
            </div>
          </>
        )}

        {mode === 'invoices' && (
          <div className="pdf-settings-section">
            <div className="pdf-settings-title">
              <FileText size={17} />
              <div>
                <h3>{t('org.mentions')}</h3>
                <p>{t('org.mentionsHint')}</p>
              </div>
            </div>
            <div className="pdf-mentions-list">
              {mentions.map((mention) => {
                const selected = isMentionSelected(mention.id);
                const placeholders = LegalMentionsService.extractPlaceholders(mention.content);
                return (
                  <div
                    key={mention.id}
                    className={`pdf-mention-card ${selected ? 'is-checked' : ''}`}
                  >
                    <label>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) => void toggleMention(mention.id, event.target.checked)}
                      />
                      <span>
                        <strong>{mention.label}</strong>
                        <small>{mention.content}</small>
                      </span>
                    </label>
                    {selected && placeholders.length > 0 && (
                      <div className="pdf-mention-placeholders">
                        <span>{t('org.mentionFill')}</span>
                        {placeholders.map((key) => (
                          <label key={key} className="org-field">
                            <span>[{key}]</span>
                            <input
                              value={emetteur.mentionPlaceholderValues?.[mention.id]?.[key] ?? ''}
                              onChange={(event) =>
                                setPlaceholderValue(mention.id, key, event.target.value)
                              }
                              placeholder={key}
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="pdf-add-mention">
              <input
                className="inv-search"
                value={newMention}
                onChange={(event) => setNewMention(event.target.value)}
                placeholder={t('org.customMentionPlaceholder')}
              />
              <button type="button" className="ct-btn-secondary" onClick={() => void addCustomMention()}>
                {t('common.add')}
              </button>
            </div>
          </div>
        )}

        <footer className="pdf-config-actions">
          <span>{t('org.previewAutoHint')}</span>
          <button className="ct-btn-primary" type="button" disabled={saving} onClick={() => void saveSelection()}>
            {saving ? t('org.saving') : t('org.savePdfSettings')}
          </button>
        </footer>
      </section>

      <PdfPreviewPanel
        documentType={mode === 'invoices' ? documentType : 'receipt'}
        emetteur={mode === 'invoices' ? emetteur : undefined}
        template={selected}
      />
    </div>
  );
};

export default PdfDocumentsPanel;
