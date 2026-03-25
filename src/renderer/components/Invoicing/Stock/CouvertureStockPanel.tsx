import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArticleStock } from '../../../types/Stock';
import { Devis, PosteMateriel } from '../../../types/Invoice';

interface CouvertureStockPanelProps {
  articles: ArticleStock[];
  devis: Devis[];
}

interface ArticleCoverage {
  article: ArticleStock;
  stockActuel: number;
  besoinDevis: number;
  ecart: number;
}

export const CouvertureStockPanel: React.FC<CouvertureStockPanelProps> = ({ articles, devis }) => {
  const { t } = useTranslation();

  const coverageData = useMemo(() => {
    const besoinParArticle = new Map<string, number>();

    const activeDevis = devis.filter((d) => !d.supprime);

    for (const devisItem of activeDevis) {
      for (const poste of devisItem.postes) {
        if (poste.type !== 'materiel') continue;
        const pm = poste as PosteMateriel;
        const links = pm.articlesLies ?? [];
        for (const link of links) {
          const need = (link.quantiteParUtilisation ?? 0) * (pm.quantite ?? 0);
          besoinParArticle.set(
            link.articleId,
            (besoinParArticle.get(link.articleId) ?? 0) + need,
          );
        }
      }
    }

    const articleIdsWithLinks = new Set(besoinParArticle.keys());
    const stockArticles = articles.filter(
      (a) =>
        (a.type === 'stock' || a.type === 'consommable') && articleIdsWithLinks.has(a.id),
    );

    const result: ArticleCoverage[] = stockArticles.map((article) => {
      const stockActuel = article.quantite ?? 0;
      const besoinDevis = besoinParArticle.get(article.id) ?? 0;
      const ecart = stockActuel - besoinDevis;
      return { article, stockActuel, besoinDevis, ecart };
    });

    return result.sort((a, b) => a.article.designation.localeCompare(b.article.designation));
  }, [articles, devis]);

  if (coverageData.length === 0) {
    return (
      <div className="invoicing-empty" style={{ padding: 24 }}>
        {t('invoicing.stock.noLinkedArticles')}
      </div>
    );
  }

  return (
    <div className="tva-table-container">
      <table className="tva-table">
        <thead>
          <tr>
            <th>{t('invoicing.stock.reference')}</th>
            <th>{t('invoicing.stock.product')}</th>
            <th>{t('invoicing.stock.currentQty')}</th>
            <th>{t('invoicing.stock.totalNeedDevis')}</th>
            <th>{t('invoicing.stock.gap')}</th>
          </tr>
        </thead>
        <tbody>
          {coverageData.map(({ article, stockActuel, besoinDevis, ecart }) => (
            <tr key={article.id}>
              <td>{article.reference || '—'}</td>
              <td>{article.designation}</td>
              <td>{stockActuel}</td>
              <td>{besoinDevis}</td>
              <td className={ecart >= 0 ? 'positive' : 'negative'}>
                {ecart >= 0 ? '+' : ''}
                {ecart}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
