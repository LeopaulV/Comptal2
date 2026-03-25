import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Check,
  Palette,
  Type,
  Layout,
  Image,
} from 'lucide-react';
import { PDFTemplate, LogoPosition } from '../../types/Invoice';
import { PDFTemplateService } from '../../services/PDFTemplateService';

interface AssociationPDFTemplateConfigProps {
  selectedTemplate: string | undefined;
  onTemplateChange: (templateId: string) => void;
}

export const AssociationPDFTemplateConfig: React.FC<AssociationPDFTemplateConfigProps> = ({
  selectedTemplate,
  onTemplateChange,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [templates, setTemplates] = useState<PDFTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customColors, setCustomColors] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const loaded = await PDFTemplateService.loadTemplates();
        setTemplates(loaded);

        const colorsMap: Record<string, string> = {};
        loaded.forEach((tmpl) => {
          colorsMap[tmpl.id] = tmpl.colors.primary;
        });
        setCustomColors(colorsMap);
      } catch (error) {
        console.error('Erreur lors du chargement des templates:', error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const getCurrentTemplate = () =>
    templates.find((tmpl) => tmpl.id === selectedTemplate) ||
    templates.find((tmpl) => tmpl.isDefault) ||
    templates[0];

  const handleColorChange = async (templateId: string, color: string) => {
    setCustomColors((prev) => ({ ...prev, [templateId]: color }));

    const template = templates.find((tmpl) => tmpl.id === templateId);
    if (template) {
      const updated = {
        ...template,
        colors: { ...template.colors, primary: color },
      };
      await PDFTemplateService.saveCustomTemplate(updated);
      setTemplates((prev) => prev.map((tmpl) => (tmpl.id === templateId ? updated : tmpl)));
    }
  };

  const getLogoPositionLabel = (position: LogoPosition) => {
    const labels: Record<LogoPosition, string> = {
      left: t('invoicing.emetteur.templates.logoLeft'),
      center: t('invoicing.emetteur.templates.logoCenter'),
      right: t('invoicing.emetteur.templates.logoRight'),
    };
    return labels[position];
  };

  const currentTemplate = getCurrentTemplate();

  return (
    <div className={`collapsible-section ${isExpanded ? 'expanded' : ''}`}>
      <button
        type="button"
        className="collapsible-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="collapsible-title">
          <FileText size={20} />
          <span>{t('invoicing.emetteur.templates.title')}</span>
        </div>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      <div className={`collapsible-content ${isExpanded ? 'expanded' : ''}`}>
        {isLoading ? (
          <div className="template-loading">{t('common.loading')}</div>
        ) : (
          <>
            <div className="template-selection">
              <label className="template-label">
                {t('invoicing.emetteur.templates.selectModel')}
              </label>
              <div className="template-cards">
                {templates.map((template) => {
                  const isSelected = selectedTemplate === template.id;

                  return (
                    <div
                      key={template.id}
                      className={`template-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => onTemplateChange(template.id)}
                    >
                      <div
                        className="template-preview"
                        style={{
                          borderColor: template.colors.primary,
                          background: `linear-gradient(135deg, ${template.colors.primary}10 0%, white 100%)`,
                        }}
                      >
                        <div
                          className="template-preview-header"
                          style={{ backgroundColor: template.colors.primary }}
                        />
                        <div className="template-preview-body">
                          <div className="template-preview-line" />
                          <div className="template-preview-line short" />
                          <div className="template-preview-table">
                            <div className="template-preview-row" />
                            <div className="template-preview-row" />
                          </div>
                        </div>
                      </div>
                      <div className="template-card-info">
                        <span className="template-card-name">{template.name}</span>
                        {isSelected && (
                          <span className="template-card-check">
                            <Check size={14} />
                          </span>
                        )}
                      </div>
                      {template.description && (
                        <span className="template-card-desc">{template.description}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {currentTemplate && (
              <div className="template-config">
                <h4 className="template-config-title">
                  {t('invoicing.emetteur.templates.customize')} - {currentTemplate.name}
                </h4>

                <div className="template-config-row">
                  <div className="template-config-label">
                    <Palette size={16} />
                    <span>{t('invoicing.emetteur.templates.primaryColor')}</span>
                  </div>
                  <div className="template-config-value">
                    <input
                      type="color"
                      value={customColors[currentTemplate.id] || currentTemplate.colors.primary}
                      onChange={(e) => handleColorChange(currentTemplate.id, e.target.value)}
                      className="template-color-input"
                    />
                    <span className="template-color-hex">
                      {customColors[currentTemplate.id] || currentTemplate.colors.primary}
                    </span>
                  </div>
                </div>

                <div className="template-config-row">
                  <div className="template-config-label">
                    <Type size={16} />
                    <span>{t('invoicing.emetteur.templates.typography')}</span>
                  </div>
                  <div className="template-config-value">
                    <span className="template-info-badge">
                      {currentTemplate.typography.headerFont}
                    </span>
                    <span className="template-info-text">
                      {currentTemplate.typography.fontSize.body}pt
                    </span>
                  </div>
                </div>

                <div className="template-config-row">
                  <div className="template-config-label">
                    <Image size={16} />
                    <span>{t('invoicing.emetteur.templates.logoPosition')}</span>
                  </div>
                  <div className="template-config-value">
                    <span className="template-info-badge">
                      {getLogoPositionLabel(currentTemplate.layout.logoPosition)}
                    </span>
                  </div>
                </div>

                <div className="template-config-row">
                  <div className="template-config-label">
                    <Layout size={16} />
                    <span>{t('invoicing.emetteur.templates.format')}</span>
                  </div>
                  <div className="template-config-value">
                    <span className="template-info-badge">
                      {currentTemplate.format}
                    </span>
                    <span className="template-info-badge">
                      {currentTemplate.orientation === 'portrait'
                        ? t('invoicing.emetteur.templates.portrait')
                        : t('invoicing.emetteur.templates.landscape')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
