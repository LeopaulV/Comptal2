import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArticleStock } from '../../../types/Stock';
import { StockService } from '../../../services/StockService';

interface ValeurPatrimonialeCardProps {
  articles: ArticleStock[];
}

export const ValeurPatrimonialeCard: React.FC<ValeurPatrimonialeCardProps> = ({ articles }) => {
  const { t } = useTranslation();

  const { valeurBrute, valeurNette, totalArticles } = useMemo(() => {
    const brute = articles.reduce((sum, item) => sum + item.valeurAcquisitionHT, 0);
    const nette = articles.reduce((sum, item) => sum + StockService.calculateVNC(item), 0);
    return {
      valeurBrute: brute,
      valeurNette: nette,
      totalArticles: articles.length,
    };
  }, [articles]);

  return (
    <div className="tva-summary-boxes">
      <div className="tva-summary-box">
        <div className="tva-summary-label">{t('invoicing.stock.totalArticles')}</div>
        <div className="tva-summary-value">{totalArticles}</div>
      </div>
      <div className="tva-summary-box">
        <div className="tva-summary-label">{t('invoicing.stock.grossValue')}</div>
        <div className="tva-summary-value">{valeurBrute.toFixed(2)} EUR</div>
      </div>
      <div className="tva-summary-box">
        <div className="tva-summary-label">{t('invoicing.stock.netValue')}</div>
        <div className="tva-summary-value positive">{valeurNette.toFixed(2)} EUR</div>
      </div>
    </div>
  );
};
