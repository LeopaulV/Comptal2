import React from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PrevisionnelWidgetProps {
  title: string;
  onRemove?: () => void;
  children: React.ReactNode;
}

const PrevisionnelWidget: React.FC<PrevisionnelWidgetProps> = ({ title, onRemove, children }) => {
  const { t } = useTranslation();
  return (
    <section className="previsionnel-widget">
      <header className="previsionnel-widget-header">
        <h3>{title}</h3>
        {onRemove && (
          <div className="previsionnel-widget-actions">
            <button type="button" className="previsionnel-icon-btn" onClick={onRemove} aria-label={t('previsionnel.hideWidget')}>
              <X size={14} />
            </button>
          </div>
        )}
      </header>
      <div className="previsionnel-widget-body">{children}</div>
    </section>
  );
};

export default PrevisionnelWidget;
