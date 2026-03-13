import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArticleStock, StockCategorie, TypeArticle } from '../../../types/Stock';
import { CategorieTag } from './CategorieTag';

interface CategorieAccordionProps {
  categories: StockCategorie[];
  articles: ArticleStock[];
  onEditCategorie: (cat: StockCategorie) => void;
  onDeleteCategorie: (cat: StockCategorie) => void;
  onEditArticle: (article: ArticleStock) => void;
  onAddArticleInCategorie: (categorieId: string | undefined) => void;
  onRefresh?: () => void;
}

/** Quantité actuelle : dernière valeur dans consommationHebdo ou article.quantite */
function getCurrentQty(article: ArticleStock): number | null {
  const hebdo = article.consommationHebdo || {};
  const weekKeys = Object.keys(hebdo).sort();
  if (weekKeys.length > 0) {
    const lastWeekKey = weekKeys[weekKeys.length - 1];
    const lastQty = hebdo[lastWeekKey];
    if (typeof lastQty === 'number') return lastQty;
  }
  return typeof article.quantite === 'number' ? article.quantite : null;
}

const TYPE_LABELS: Record<TypeArticle, string> = {
  immobilisation: 'invoicing.stock.typeOptions.immobilisation',
  stock: 'invoicing.stock.typeOptions.stock',
  consommable: 'invoicing.stock.typeOptions.consommable',
  achat_ponctuel: 'invoicing.stock.typeOptions.achat_ponctuel',
};

export const CategorieAccordion: React.FC<CategorieAccordionProps> = ({
  categories,
  articles,
  onEditCategorie,
  onDeleteCategorie,
  onEditArticle,
  onAddArticleInCategorie,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const articlesByCategorie = React.useMemo(() => {
    const map = new Map<string | 'none', ArticleStock[]>();
    for (const a of articles) {
      const key = a.categorieId ?? 'none';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [articles]);

  const sortedCategories = [...categories].sort((a, b) => a.nom.localeCompare(b.nom));

  return (
    <div className="categorie-accordion">
      {sortedCategories.map((cat) => {
        const arts = articlesByCategorie.get(cat.id) ?? [];
        const isExpanded = expandedIds.has(cat.id);

        return (
          <div key={cat.id} className="categorie-accordion-group">
            <div
              className="categorie-accordion-header"
              onClick={() => toggle(cat.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && toggle(cat.id)}
            >
              <span className="categorie-accordion-chevron">{isExpanded ? '▼' : '▶'}</span>
              <input
                type="color"
                value={cat.couleur || '#1955a3'}
                onChange={async (e) => {
                  e.stopPropagation();
                  const updated = { ...cat, couleur: e.target.value };
                  try {
                    const { StockService } = await import('../../../services/StockService');
                    await StockService.upsertCategorie(updated);
                    await onRefresh?.();
                  } catch {
                    /* ignore */
                  }
                }}
                className="categorie-accordion-color-input"
                title={t('invoicing.stock.color')}
                onClick={(e) => e.stopPropagation()}
              />
              <CategorieTag label={cat.nom} color={cat.couleur} />
              <span className="categorie-accordion-count">({arts.length})</span>
              <div className="categorie-accordion-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => onEditCategorie(cat)}
                  style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                >
                  {t('common.edit')}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => onDeleteCategorie(cat)}
                  style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
            {isExpanded && (
              <div className="categorie-accordion-body">
                <table className="tva-table categorie-accordion-table">
                  <thead>
                    <tr>
                      <th>{t('invoicing.stock.color')}</th>
                      <th>{t('invoicing.stock.designation')}</th>
                      <th>{t('invoicing.stock.reference')}</th>
                      <th>{t('invoicing.stock.type')}</th>
                      <th>{t('invoicing.stock.amountHT')}</th>
                      <th>{t('invoicing.stock.currentQty')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {arts.map((a) => (
                      <tr key={a.id} className="categorie-accordion-row">
                        <td>
                          <input
                            type="color"
                            value={a.couleur || categories.find((c) => c.id === a.categorieId)?.couleur || '#dbeafe'}
                            onChange={async (e) => {
                              const updated = { ...a, couleur: e.target.value };
                              try {
                                const { StockService } = await import('../../../services/StockService');
                                await StockService.upsertArticle(updated);
                                await onRefresh?.();
                              } catch {
                                /* ignore */
                              }
                            }}
                            className="categorie-accordion-color-input"
                            title={t('invoicing.stock.color')}
                          />
                        </td>
                        <td>{a.designation}</td>
                        <td>{a.reference || '—'}</td>
                        <td>{t(TYPE_LABELS[a.type])}</td>
                        <td>{a.valeurAcquisitionHT.toFixed(2)} €</td>
                        <td>{getCurrentQty(a) ?? '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="secondary"
                            style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                            onClick={() => onEditArticle(a)}
                          >
                            {t('common.edit')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  type="button"
                  className="secondary"
                  style={{ marginTop: 8 }}
                  onClick={() => onAddArticleInCategorie(cat.id)}
                >
                  + {t('invoicing.stock.addArticle')}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Sans catégorie */}
      <div className="categorie-accordion-group">
        <div
          className="categorie-accordion-header"
          onClick={() => toggle('none')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && toggle('none')}
        >
          <span className="categorie-accordion-chevron">
            {expandedIds.has('none') ? '▼' : '▶'}
          </span>
          <span className="categorie-accordion-label">{t('common.none')}</span>
          <span className="categorie-accordion-count">
            ({(articlesByCategorie.get('none') ?? []).length})
          </span>
        </div>
        {expandedIds.has('none') && (
          <div className="categorie-accordion-body">
            <table className="tva-table categorie-accordion-table">
              <thead>
                <tr>
                  <th>{t('invoicing.stock.color')}</th>
                  <th>{t('invoicing.stock.designation')}</th>
                  <th>{t('invoicing.stock.reference')}</th>
                  <th>{t('invoicing.stock.type')}</th>
                  <th>{t('invoicing.stock.amountHT')}</th>
                  <th>{t('invoicing.stock.currentQty')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(articlesByCategorie.get('none') ?? []).map((a) => (
                  <tr key={a.id} className="categorie-accordion-row">
                    <td>
                      <input
                        type="color"
                        value={a.couleur || categories.find((c) => c.id === a.categorieId)?.couleur || '#dbeafe'}
                        onChange={async (e) => {
                          const updated = { ...a, couleur: e.target.value };
                          try {
                            const { StockService } = await import('../../../services/StockService');
                            await StockService.upsertArticle(updated);
                            await onRefresh?.();
                          } catch {
                            /* ignore */
                          }
                        }}
                        className="categorie-accordion-color-input"
                        title={t('invoicing.stock.color')}
                      />
                    </td>
                    <td>{a.designation}</td>
                    <td>{a.reference || '—'}</td>
                    <td>{t(TYPE_LABELS[a.type])}</td>
                    <td>{a.valeurAcquisitionHT.toFixed(2)} €</td>
                    <td>{getCurrentQty(a) ?? '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary"
                        style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                        onClick={() => onEditArticle(a)}
                      >
                        {t('common.edit')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              className="secondary"
              style={{ marginTop: 8 }}
              onClick={() => onAddArticleInCategorie(undefined)}
            >
              + {t('invoicing.stock.addArticle')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
