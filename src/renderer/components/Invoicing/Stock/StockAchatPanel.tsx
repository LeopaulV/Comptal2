import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArticleStock, StockCategorie } from '../../../types/Stock';
import { StockService } from '../../../services/StockService';
import { ArticleModal } from './ArticleModal';
import { CategorieModal } from './CategorieModal';
import { InventaireTable } from './InventaireTable';
import { AmortissementTable } from './AmortissementTable';
import { CategorieAccordion } from './CategorieAccordion';
import { ValeurPatrimonialeCard } from './ValeurPatrimonialeCard';
import { ObligationsLegalesPanel } from './ObligationsLegalesPanel';

type StockTab = 'inventaire' | 'amortissements' | 'categories' | 'valeur';

interface StockAchatPanelProps {
  onStockChange?: () => void;
}

export const StockAchatPanel: React.FC<StockAchatPanelProps> = ({ onStockChange }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<StockTab>('inventaire');
  const [articles, setArticles] = useState<ArticleStock[]>([]);
  const [categories, setCategories] = useState<StockCategorie[]>([]);
  const [articleModalOpen, setArticleModalOpen] = useState(false);
  const [categorieModalOpen, setCategorieModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<ArticleStock | null>(null);
  const [editingCategorie, setEditingCategorie] = useState<StockCategorie | null>(null);
  const [initialCategorieId, setInitialCategorieId] = useState<string | undefined>(undefined);

  const loadData = async () => {
    const [loadedArticles, loadedCategories] = await Promise.all([
      StockService.loadArticles(),
      StockService.loadCategories(),
    ]);
    setArticles(loadedArticles);
    setCategories(loadedCategories);
    onStockChange?.();
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNewArticle = (categorieId?: string) => {
    setEditingArticle(null);
    setInitialCategorieId(categorieId);
    setArticleModalOpen(true);
  };

  const openEditArticle = (article: ArticleStock) => {
    setEditingArticle(article);
    setInitialCategorieId(undefined);
    setArticleModalOpen(true);
  };

  const openNewCategorie = () => {
    setEditingCategorie(null);
    setCategorieModalOpen(true);
  };

  return (
    <div className="invoicing-panel">
      <div className="invoicing-card">
        <div className="invoicing-header-row">
          <div>
            <h2>{t('invoicing.stock.title')}</h2>
            <p>{t('invoicing.stock.subtitle')}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="secondary" onClick={openNewCategorie}>
              + {t('invoicing.stock.addCategory')}
            </button>
            <button type="button" className="primary" onClick={() => openNewArticle()}>
              + {t('invoicing.stock.addArticle')}
            </button>
          </div>
        </div>

        <div className="association-registre-filters" style={{ marginBottom: 16 }}>
          <button
            type="button"
            className={`association-registre-filter-btn ${activeTab === 'inventaire' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventaire')}
          >
            {t('invoicing.stock.tabs.inventaire')}
          </button>
          <button
            type="button"
            className={`association-registre-filter-btn ${activeTab === 'amortissements' ? 'active' : ''}`}
            onClick={() => setActiveTab('amortissements')}
          >
            {t('invoicing.stock.tabs.amortissements')}
          </button>
          <button
            type="button"
            className={`association-registre-filter-btn ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            {t('invoicing.stock.tabs.categories')}
          </button>
          <button
            type="button"
            className={`association-registre-filter-btn ${activeTab === 'valeur' ? 'active' : ''}`}
            onClick={() => setActiveTab('valeur')}
          >
            {t('invoicing.stock.tabs.value')}
          </button>
        </div>

        {activeTab === 'inventaire' && (
          <InventaireTable
            articles={articles}
            categories={categories}
            onRefresh={loadData}
            onEditArticle={openEditArticle}
          />
        )}

        {activeTab === 'amortissements' && (
          <AmortissementTable articles={articles} onRefresh={loadData} />
        )}

        {activeTab === 'categories' && (
          <CategorieAccordion
            categories={categories}
            articles={articles}
            onEditCategorie={(cat) => {
              setEditingCategorie(cat);
              setCategorieModalOpen(true);
            }}
            onDeleteCategorie={async (cat) => {
              await StockService.deleteCategorie(cat.id);
              await loadData();
            }}
            onEditArticle={openEditArticle}
            onAddArticleInCategorie={openNewArticle}
            onRefresh={loadData}
          />
        )}

        {activeTab === 'valeur' && (
          <>
            <ValeurPatrimonialeCard articles={articles} />
            <ObligationsLegalesPanel />
          </>
        )}
      </div>

      <ArticleModal
        isOpen={articleModalOpen}
        article={editingArticle}
        initialCategorieId={initialCategorieId}
        categories={categories}
        onClose={() => {
          setArticleModalOpen(false);
          setEditingArticle(null);
          setInitialCategorieId(undefined);
        }}
        onSaved={async () => {
          setArticleModalOpen(false);
          setEditingArticle(null);
          setInitialCategorieId(undefined);
          await loadData();
        }}
      />

      <CategorieModal
        isOpen={categorieModalOpen}
        categorie={editingCategorie}
        onClose={() => {
          setCategorieModalOpen(false);
          setEditingCategorie(null);
        }}
        onSaved={async () => {
          setCategorieModalOpen(false);
          setEditingCategorie(null);
          await loadData();
        }}
      />
    </div>
  );
};
