import React from 'react';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import InfoTooltip from './InfoTooltip';

interface MetricInfoLabelProps {
  label: React.ReactNode;
  info: React.ReactNode;
  className?: string;
}

const MetricInfoLabel: React.FC<MetricInfoLabelProps> = ({ label, info, className = '' }) => {
  const { t } = useTranslation();
  return (
  <span className={`metric-info-label ${className}`}>
    {label}
    <InfoTooltip content={info}>
      <span className="metric-info-icon" aria-label={t('common.info')}>
        <Info size={14} />
      </span>
    </InfoTooltip>
  </span>
  );
};

export default MetricInfoLabel;
