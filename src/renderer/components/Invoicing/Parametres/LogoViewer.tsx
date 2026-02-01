import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Upload, Trash2, ExternalLink, Image } from 'lucide-react';

interface LogoViewerProps {
  logo?: string;
  onLogoChange: (logo: string | undefined) => void;
}

export const LogoViewer: React.FC<LogoViewerProps> = ({ logo, onLogoChange }) => {
  const { t } = useTranslation();
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Vérification du type de fichier
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError(t('invoicing.emetteur.logo.invalidType'));
      return;
    }

    // Vérification de la taille (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError(t('invoicing.emetteur.logo.tooLarge'));
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        onLogoChange(result);
      }
    };
    reader.onerror = () => {
      setError(t('invoicing.emetteur.logo.readError'));
    };
    reader.readAsDataURL(file);
  };

  const handleOpenExternal = async () => {
    if (!logo) return;

    setIsOpening(true);
    setError(null);

    try {
      // Extraire les données base64 et l'extension
      const matches = logo.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) {
        setError(t('invoicing.emetteur.logo.invalidFormat'));
        setIsOpening(false);
        return;
      }

      const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      const base64Data = matches[2];
      const tempFileName = `temp_logo_${Date.now()}.${extension}`;
      const tempPath = `data/attachments/${tempFileName}`;

      // Sauvegarder temporairement le logo
      const writeResult = await window.electronAPI.writeBinaryFile(tempPath, base64Data);
      if (!writeResult.success) {
        setError(writeResult.error || t('invoicing.emetteur.logo.saveError'));
        setIsOpening(false);
        return;
      }

      // Ouvrir avec l'application par défaut
      const openResult = await window.electronAPI.openPath(tempPath);
      if (!openResult.success) {
        setError(openResult.error || t('invoicing.emetteur.logo.openError'));
      }
    } catch (err: any) {
      setError(err.message || t('invoicing.emetteur.logo.error'));
    } finally {
      setIsOpening(false);
    }
  };

  const handleRemoveLogo = () => {
    onLogoChange(undefined);
    setError(null);
  };

  return (
    <div className="logo-viewer">
      <div className="logo-viewer-header">
        <div className="logo-viewer-title">
          <Image size={18} />
          <span>{t('invoicing.emetteur.logo.title')}</span>
        </div>
      </div>

      <div className="logo-viewer-content">
        {logo ? (
          <div className="logo-viewer-preview">
            <div 
              className="logo-thumbnail"
              onClick={handleOpenExternal}
              title={t('invoicing.emetteur.logo.clickToOpen')}
            >
              <img src={logo} alt={t('invoicing.emetteur.logo.alt')} />
              <div className="logo-thumbnail-overlay">
                <Eye size={20} />
              </div>
            </div>
            <div className="logo-viewer-actions">
              <button
                type="button"
                className="logo-action-btn primary"
                onClick={handleOpenExternal}
                disabled={isOpening}
                title={t('invoicing.emetteur.logo.openExternal')}
              >
                <ExternalLink size={16} />
                <span>{isOpening ? t('invoicing.emetteur.logo.opening') : t('invoicing.emetteur.logo.view')}</span>
              </button>
              <label className="logo-action-btn secondary">
                <Upload size={16} />
                <span>{t('invoicing.emetteur.logo.change')}</span>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </label>
              <button
                type="button"
                className="logo-action-btn danger"
                onClick={handleRemoveLogo}
                title={t('invoicing.emetteur.logo.remove')}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="logo-viewer-upload">
            <label className="logo-upload-zone">
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <div className="logo-upload-content">
                <Upload size={32} className="logo-upload-icon" />
                <span className="logo-upload-text">{t('invoicing.emetteur.logo.upload')}</span>
                <span className="logo-upload-hint">{t('invoicing.emetteur.logo.hint')}</span>
              </div>
            </label>
          </div>
        )}

        {error && (
          <div className="logo-viewer-error">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};
