import React from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { isTransferCategory } from '../../utils/categories';
import InfoTooltip from './InfoTooltip';

interface CategorySwatchProps {
  code: string;
  color: string;
  className?: string;
}

export const CategorySwatch: React.FC<CategorySwatchProps> = ({ code, color, className = '' }) => (
  <span
    className={`category-swatch${isTransferCategory(code) ? ' category-swatch-transparent' : ''} ${className}`.trim()}
    style={isTransferCategory(code) ? undefined : { backgroundColor: color }}
    aria-hidden
  />
);

export const CategoryXInfo: React.FC = () => {
  const { t } = useTranslation();
  return (
    <InfoTooltip
      content={
        <div>
          <strong>{t('common.categoryXTitle')}</strong>
          <p>{t('common.categoryXHint')}</p>
        </div>
      }
    >
      <span className="metric-info-icon" aria-label={t('common.categoryXTitle')}>
        <Info size={14} />
      </span>
    </InfoTooltip>
  );
};
