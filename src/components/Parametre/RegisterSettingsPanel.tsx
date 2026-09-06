import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpenCheck, FileCog, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Logger } from '../../services/logger';
import { RegisterPDFService } from '../../services/RegisterPDFService';
import { RegisterService } from '../../services/RegisterService';
import {
  ALL_REGISTER_DOCUMENT_TYPES,
  RegisterDocumentType,
  RegisterSettings,
} from '../../types/register';
import { registerTypeShortTitle, registerTypeTitle } from '../../utils/registerI18n';
import RegisterTypeEnableList from '../Register/RegisterTypeEnableList';

const NUMBER_PRESETS = [
  { id: 'prefix-year-seq', format: '{PREFIX}-{YEAR}-{SEQ:4}', labelKey: 'register.settings.presetPrefixYearSeq' as const },
  { id: 'prefix-seq', format: '{PREFIX}-{SEQ:4}', labelKey: 'register.settings.presetPrefixSeq' as const },
  { id: 'year-seq', format: '{YEAR}-{SEQ:4}', labelKey: 'register.settings.presetYearSeq' as const },
  { id: 'slash', format: '{PREFIX}/{YEAR}/{SEQ:4}', labelKey: 'register.settings.presetSlash' as const },
] as const;

const canonicalFormat = (format: string) => format.replace(/\{SEQ:\d+\}/, '{SEQ}');

const RegisterSettingsPanel: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<RegisterSettings>(RegisterService.defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewType, setPreviewType] = useState<RegisterDocumentType>('donation_journal');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [customFormat, setCustomFormat] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    RegisterService.loadSettings()
      .then((loaded) => {
        setSettings(loaded);
        setCustomFormat(
          !NUMBER_PRESETS.some((preset) => canonicalFormat(preset.format) === canonicalFormat(loaded.numberFormat))
        );
        const enabled = RegisterService.enabledTypes(loaded);
        if (!enabled.includes(previewType) && enabled[0]) setPreviewType(enabled[0]);
      })
      .catch(() => toast.error(t('register.settings.loadFail')))
      .finally(() => setLoading(false));
  }, []);

  const enabledTypes = RegisterService.enabledTypes(settings);
  const seqSize = RegisterService.seqSize(settings.numberFormat);
  const previewNumber = RegisterService.previewNumber(settings);
  const previewTypes = useMemo(
    () => ALL_REGISTER_DOCUMENT_TYPES.filter((type) => enabledTypes.includes(type)),
    [enabledTypes]
  );

  useEffect(() => {
    if (loading) return;
    if (!enabledTypes.includes(previewType) && previewTypes[0]) {
      setPreviewType(previewTypes[0]);
    }
  }, [enabledTypes, previewType, previewTypes, loading]);

  useEffect(() => {
    if (loading) return;
    const current = ++generation.current;
    const timer = window.setTimeout(() => {
      setPreviewLoading(true);
      setPreviewError('');
      void RegisterPDFService.generatePreviewDataUrl(settings, previewType)
        .then((url) => {
          if (generation.current === current) setPreviewUrl(url);
        })
        .catch((error) => {
          Logger.error('RegisterSettingsPanel.preview', error);
          if (generation.current === current) {
            setPreviewError(error instanceof Error ? error.message : t('register.settings.previewFail'));
          }
        })
        .finally(() => {
          if (generation.current === current) setPreviewLoading(false);
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [settings, previewType, loading, i18n.language]);

  const applyPreset = (format: string) => {
    setCustomFormat(false);
    setSettings((current) => ({
      ...current,
      numberFormat: RegisterService.withSeqSize(format, RegisterService.seqSize(current.numberFormat)),
    }));
  };

  const toggleType = (type: RegisterDocumentType) => {
    const current = RegisterService.enabledTypes(settings);
    const next = current.includes(type)
      ? current.filter((item) => item !== type)
      : [...current, type];
    if (next.length === 0) {
      toast.info(t('register.keepOneType'));
      return;
    }
    setSettings({ ...settings, enabledTypes: next });
  };

  const save = async () => {
    setSaving(true);
    try {
      await RegisterService.saveSettings({
        ...settings,
        enabledTypes: RegisterService.enabledTypes(settings),
      });
      toast.success(t('register.settings.saved'));
    } catch {
      toast.error(t('register.settings.saveFail'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="ct-card">{t('common.loading')}</div>;

  const activePreset = customFormat
    ? null
    : NUMBER_PRESETS.find((preset) => canonicalFormat(preset.format) === canonicalFormat(settings.numberFormat));

  return (
    <div className="pdf-config-layout">
      <section className="pdf-config-panel">
        <header className="org-panel-heading">
          <span className="org-panel-icon"><FileCog size={19} /></span>
          <div>
            <h2>{t('register.settings.title')}</h2>
            <p>{t('register.settings.hint')}</p>
          </div>
        </header>

        {previewTypes.length > 0 && (
          <div
            className="pdf-document-switch"
            role="tablist"
            style={{ gridTemplateColumns: `repeat(${Math.min(previewTypes.length, 3)}, minmax(0, 1fr))` }}
          >
            {previewTypes.map((type) => (
              <button
                key={type}
                type="button"
                className={previewType === type ? 'active' : ''}
                onClick={() => setPreviewType(type)}
              >
                <BookOpenCheck size={15} />
                {registerTypeShortTitle(type)}
              </button>
            ))}
          </div>
        )}

        <div className="pdf-settings-section">
          <div className="pdf-settings-title">
            <FileCog size={17} />
            <div>
              <h3>{t('register.settings.numbering')}</h3>
              <p>{t('register.settings.numberingHint')}</p>
            </div>
          </div>
          <div className="pdf-number-preview">
            <div>
              <span>{t('register.settings.nextNumber')}</span>
              <strong>{previewNumber}</strong>
            </div>
          </div>
          <div className="pdf-template-grid pdf-number-presets">
            {NUMBER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`pdf-template-card${activePreset?.id === preset.id ? ' selected' : ''}`}
                onClick={() => applyPreset(preset.format)}
              >
                <span>
                  <strong>{t(preset.labelKey)}</strong>
                  <small>{RegisterService.previewNumber({ ...settings, numberFormat: RegisterService.withSeqSize(preset.format, seqSize) })}</small>
                </span>
              </button>
            ))}
            <button
              type="button"
              className={`pdf-template-card${customFormat ? ' selected' : ''}`}
              onClick={() => setCustomFormat(true)}
            >
              <span>
                <strong>{t('register.settings.customFormat')}</strong>
                <small>{t('register.settings.customFormatHint')}</small>
              </span>
            </button>
          </div>
          <div className="org-grid" style={{ marginTop: 12 }}>
            <label className="org-field">
              <span>{t('register.settings.prefix')}</span>
              <input value={settings.prefix} onChange={(e) => setSettings({ ...settings, prefix: e.target.value.toUpperCase() })} />
            </label>
            <label className="org-field">
              <span>{t('register.settings.nextSequence')}</span>
              <input type="number" min={1} value={settings.nextSequence} onChange={(e) => setSettings({ ...settings, nextSequence: Math.max(1, Number(e.target.value)) })} />
            </label>
            <div className="org-field">
              <span>{t('register.settings.digitCount')}</span>
              <div className="pdf-seq-pills">
                {[3, 4, 5].map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={seqSize === size ? 'active' : ''}
                    onClick={() => setSettings({ ...settings, numberFormat: RegisterService.withSeqSize(settings.numberFormat, size) })}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            {customFormat && (
              <label className="org-field full">
                <span>{t('register.settings.freeTemplate')}</span>
                <input
                  value={settings.numberFormat}
                  onChange={(e) => setSettings({ ...settings, numberFormat: e.target.value })}
                  placeholder="{PREFIX}-{YEAR}-{SEQ:4}"
                />
                <small className="org-field-hint">{t('register.settings.freeTemplateHint')}</small>
              </label>
            )}
            <label className="org-field full">
              <span>{t('register.settings.defaultTitle')}</span>
              <input value={settings.defaultTitle} onChange={(e) => setSettings({ ...settings, defaultTitle: e.target.value })} />
            </label>
            <label className="org-field full">
              <span>{t('register.settings.defaultNotes')}</span>
              <textarea value={settings.defaultNotes} onChange={(e) => setSettings({ ...settings, defaultNotes: e.target.value })} />
            </label>
          </div>
        </div>

        <div className="pdf-settings-section">
          <div className="pdf-settings-title">
            <FileCog size={17} />
            <div>
              <h3>{t('register.settings.enabledTypes')}</h3>
              <p>{t('register.settings.enabledTypesHint')}</p>
            </div>
          </div>
          <RegisterTypeEnableList enabledTypes={enabledTypes} onToggle={toggleType} />
        </div>

        <div className="pdf-settings-section">
          <div className="pdf-settings-title">
            <FileCog size={17} />
            <div>
              <h3>{t('register.settings.pdfFormat')}</h3>
              <p>{t('register.settings.pdfFormatHint')}</p>
            </div>
          </div>
          <div className="org-grid">
            <label className="org-field">
              <span>{t('register.settings.format')}</span>
              <select value={settings.pdfFormat} onChange={(e) => setSettings({ ...settings, pdfFormat: e.target.value as RegisterSettings['pdfFormat'] })}>
                <option>A4</option>
                <option>Letter</option>
              </select>
            </label>
            <label className="org-field">
              <span>{t('register.settings.orientation')}</span>
              <select value={settings.pdfOrientation} onChange={(e) => setSettings({ ...settings, pdfOrientation: e.target.value as RegisterSettings['pdfOrientation'] })}>
                <option value="portrait">{t('register.settings.portrait')}</option>
                <option value="landscape">{t('register.settings.landscape')}</option>
              </select>
            </label>
            <label className="org-field">
              <span>{t('register.settings.accentColor')}</span>
              <input type="color" value={settings.accentColor} onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })} />
            </label>
            <label className="org-field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={settings.includeOrganization} onChange={(e) => setSettings({ ...settings, includeOrganization: e.target.checked })} />
              <span>{t('register.settings.includeOrg')}</span>
            </label>
          </div>
        </div>

        <footer className="pdf-config-actions">
          <span>{previewLoading ? t('register.settings.generatingPreview') : previewError || t('register.settings.pdfFormatHint')}</span>
          <button className="ct-btn-primary" type="button" disabled={saving} onClick={() => void save()}>
            <Save size={17} /> {saving ? t('common.saving') : t('common.save')}
          </button>
        </footer>
      </section>

      <aside className="pdf-live-preview">
        <header className="pdf-live-preview-header">
          <div>
            <span className="pdf-live-preview-eyebrow">{t('register.settings.livePreview')}</span>
            <h3>{registerTypeTitle(previewType)}</h3>
          </div>
        </header>
        <div className="pdf-live-preview-stage">
          {previewLoading && <div className="pdf-preview-state"><span>{t('register.settings.generatingPreview')}</span></div>}
          {!previewLoading && previewError && <div className="pdf-preview-state is-error"><span>{previewError}</span></div>}
          {!previewLoading && !previewError && previewUrl && (
            <div className="pdf-preview-frame-wrap" style={{ width: '80%' }}>
              <iframe className="pdf-preview-frame" src={previewUrl} title={t('register.settings.previewIframe')} />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

export default RegisterSettingsPanel;
