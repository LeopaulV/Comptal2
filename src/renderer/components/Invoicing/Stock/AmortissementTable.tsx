import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArticleStock } from '../../../types/Stock';
import { StockService } from '../../../services/StockService';

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

function getYearsOwned(article: ArticleStock): number {
  if (article.anneesDetention != null) return article.anneesDetention;
  const elapsed = (Date.now() - article.dateAcquisition.getTime()) / MS_PER_YEAR;
  return Math.max(0, elapsed);
}

interface AmortissementTableProps {
  articles: ArticleStock[];
  onRefresh?: () => void;
}

export const AmortissementTable: React.FC<AmortissementTableProps> = ({
  articles,
  onRefresh = () => {},
}) => {
  const { t } = useTranslation();
  const [savingId, setSavingId] = useState<string | null>(null);

  const amortissables = articles.filter(
    (a) => a.type === 'immobilisation' || a.type === 'achat_ponctuel',
  );

  const handleYearsBlur = useCallback(
    async (article: ArticleStock, value: string) => {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) return;
      if (num === getYearsOwned(article)) return;
      setSavingId(article.id);
      try {
        await StockService.upsertArticle({ ...article, anneesDetention: num });
        onRefresh();
      } finally {
        setSavingId(null);
      }
    },
    [onRefresh],
  );

  return (
    <div className="tva-table-container">
      <table className="tva-table">
        <thead>
          <tr>
            <th>{t('invoicing.stock.designation')}</th>
            <th>{t('invoicing.stock.type')}</th>
            <th>{t('invoicing.stock.amountHT')}</th>
            <th>{t('invoicing.stock.acquisitionDate')}</th>
            <th>{t('invoicing.stock.yearsOwned')}</th>
            <th>{t('invoicing.stock.depreciationPerYear')}</th>
            <th>{t('invoicing.stock.depreciationCumulative')}</th>
            <th>{t('invoicing.stock.netValue')}</th>
          </tr>
        </thead>
        <tbody>
          {amortissables.length === 0 ? (
            <tr>
              <td colSpan={8} className="tva-empty">
                {t('invoicing.stock.noDepreciation')}
              </td>
            </tr>
          ) : (
            amortissables.map((article) => {
              const duree = article.dureeAmortissement ?? (article.type === 'achat_ponctuel' ? 5 : 0);
              const base =
                article.valeurAcquisitionHT - (article.valeurResiduelle || 0);
              const annual = duree > 0 ? base / duree : 0;
              const amorti = StockService.calculateAmortissementCumule(article);
              const vnc = StockService.calculateVNC(article);
              const yearsOwned = getYearsOwned(article);

              return (
                <tr key={article.id}>
                  <td>{article.designation}</td>
                  <td>{t(`invoicing.stock.typeOptions.${article.type}`)}</td>
                  <td>{article.valeurAcquisitionHT.toFixed(2)} €</td>
                  <td>
                    {article.dateAcquisition.toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      className="inventaire-input-narrow"
                      defaultValue={yearsOwned.toFixed(1)}
                      onBlur={(e) => handleYearsBlur(article, e.target.value)}
                      disabled={savingId === article.id}
                    />
                  </td>
                  <td>{annual.toFixed(2)} €</td>
                  <td>{amorti.toFixed(2)} €</td>
                  <td>{vnc.toFixed(2)} €</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};
