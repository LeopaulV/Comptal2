import {
  AchatRegistreEntry,
  ArticleStock,
  ArticleStockSerialized,
  MouvementStock,
  MouvementStockSerialized,
  StockCategorie,
  StockCategorieSerialized,
} from '../types/Stock';
import { FileService } from './FileService';
import {
  ChartGranularity,
  getPeriodKey,
  getPeriodKeysInRange,
  sortPeriodKeys,
} from './DataService';

const ARTICLES_PATH = 'parametre/stock_articles.json';
const CATEGORIES_PATH = 'parametre/stock_categories.json';
const MOUVEMENTS_PATH = 'parametre/stock_mouvements.json';

/** Stockage inventaire : les articles de type stock/consommable et leur consommationHebdo (clé YYYY-Www) sont dans stock_articles.json */
export class StockService {
  private static articlesCache: ArticleStock[] | null = null;
  private static categoriesCache: StockCategorie[] | null = null;
  private static mouvementsCache: MouvementStock[] | null = null;

  static async loadArticles(): Promise<ArticleStock[]> {
    if (this.articlesCache) return [...this.articlesCache];
    try {
      const content = await FileService.readFile(ARTICLES_PATH);
      const parsed: ArticleStockSerialized[] = JSON.parse(content);
      const data = parsed.map((item) => this.deserializeArticle(item));
      this.articlesCache = data;
      return data;
    } catch {
      this.articlesCache = [];
      return [];
    }
  }

  static async saveArticles(articles: ArticleStock[]): Promise<void> {
    const serialized = articles.map((item) => this.serializeArticle(item));
    await FileService.writeFile(ARTICLES_PATH, JSON.stringify(serialized, null, 2));
    this.articlesCache = articles;
  }

  static async upsertArticle(article: ArticleStock): Promise<void> {
    const list = await this.loadArticles();
    const idx = list.findIndex((item) => item.id === article.id);
    const now = new Date();
    const normalized: ArticleStock = {
      ...article,
      updatedAt: now,
      createdAt: article.createdAt || now,
    };
    if (idx >= 0) {
      list[idx] = normalized;
    } else {
      list.push(normalized);
    }
    await this.saveArticles(list);
  }

  static async deleteArticle(articleId: string): Promise<void> {
    const list = await this.loadArticles();
    const filtered = list.filter((item) => item.id !== articleId);
    await this.saveArticles(filtered);
  }

  static async loadCategories(): Promise<StockCategorie[]> {
    if (this.categoriesCache) return [...this.categoriesCache];
    try {
      const content = await FileService.readFile(CATEGORIES_PATH);
      const parsed: StockCategorieSerialized[] = JSON.parse(content);
      const data = parsed.map((item) => ({
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      }));
      this.categoriesCache = data;
      return data;
    } catch {
      this.categoriesCache = [];
      return [];
    }
  }

  static async saveCategories(categories: StockCategorie[]): Promise<void> {
    const serialized: StockCategorieSerialized[] = categories.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));
    await FileService.writeFile(CATEGORIES_PATH, JSON.stringify(serialized, null, 2));
    this.categoriesCache = categories;
  }

  static async upsertCategorie(categorie: StockCategorie): Promise<void> {
    const list = await this.loadCategories();
    const idx = list.findIndex((item) => item.id === categorie.id);
    const now = new Date();
    const normalized: StockCategorie = {
      ...categorie,
      updatedAt: now,
      createdAt: categorie.createdAt || now,
    };
    if (idx >= 0) {
      list[idx] = normalized;
    } else {
      list.push(normalized);
    }
    await this.saveCategories(list);
  }

  static async deleteCategorie(categorieId: string): Promise<void> {
    const categories = await this.loadCategories();
    const updatedCategories = categories.filter((item) => item.id !== categorieId);
    await this.saveCategories(updatedCategories);

    const articles = await this.loadArticles();
    const updatedArticles = articles.map((article) =>
      article.categorieId === categorieId ? { ...article, categorieId: undefined, updatedAt: new Date() } : article,
    );
    await this.saveArticles(updatedArticles);
  }

  static async loadMouvements(): Promise<MouvementStock[]> {
    if (this.mouvementsCache) return this.mouvementsCache;
    try {
      const content = await FileService.readFile(MOUVEMENTS_PATH);
      const parsed: MouvementStockSerialized[] = JSON.parse(content);
      const data = parsed.map((item) => ({ ...item, date: new Date(item.date) }));
      this.mouvementsCache = data;
      return data;
    } catch {
      this.mouvementsCache = [];
      return [];
    }
  }

  static async saveMouvements(mouvements: MouvementStock[]): Promise<void> {
    const serialized: MouvementStockSerialized[] = mouvements.map((item) => ({
      ...item,
      date: item.date.toISOString(),
    }));
    await FileService.writeFile(MOUVEMENTS_PATH, JSON.stringify(serialized, null, 2));
    this.mouvementsCache = mouvements;
  }

  static calculateAmortissementCumule(article: ArticleStock, endDate = new Date()): number {
    if (article.type !== 'immobilisation' && article.type !== 'achat_ponctuel') return 0;
    const duree = article.dureeAmortissement ?? (article.type === 'achat_ponctuel' ? 5 : 0);
    if (duree <= 0) return 0;

    const base = article.valeurAcquisitionHT - (article.valeurResiduelle || 0);
    if (base <= 0) return 0;

    const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
    const elapsedYears =
      article.anneesDetention ??
      Math.max(0, (endDate.getTime() - article.dateAcquisition.getTime()) / msPerYear);
    const annual = base / duree;

    if (article.methodeAmortissement === 'degressif') {
      const coefficient = 1.75;
      const value = annual * coefficient * elapsedYears;
      return Math.min(base, value);
    }

    return Math.min(base, annual * Math.min(elapsedYears, duree));
  }

  static calculateVNC(article: ArticleStock, endDate = new Date()): number {
    const amortissements = this.calculateAmortissementCumule(article, endDate);
    return Math.max(0, article.valeurAcquisitionHT - amortissements);
  }

  /**
   * Retourne les achats stock agrégés par période (pour graphique Bilan Financier).
   * Utilise dateAcquisition des articles et valeurAcquisitionHT.
   */
  static async getAchatsByPeriod(
    granularity: ChartGranularity,
    dateFrom?: Date | null,
    dateTo?: Date | null
  ): Promise<{ periodKeys: string[]; amounts: number[] }> {
    const articles = await this.loadArticles();
    const filtered =
      dateFrom && dateTo
        ? articles.filter((a) => {
            const t = a.dateAcquisition.getTime();
            return t >= dateFrom.getTime() && t <= dateTo.getTime();
          })
        : articles;

    let periodKeys: string[];
    if (dateFrom && dateTo) {
      periodKeys = getPeriodKeysInRange(dateFrom, dateTo, granularity);
    } else {
      const keysSet = new Set<string>();
      filtered.forEach((a) => keysSet.add(getPeriodKey(a.dateAcquisition, granularity)));
      periodKeys = sortPeriodKeys(Array.from(keysSet), granularity);
    }

    const amountByPeriod = new Map<string, number>();
    periodKeys.forEach((k) => amountByPeriod.set(k, 0));
    filtered.forEach((a) => {
      const k = getPeriodKey(a.dateAcquisition, granularity);
      const current = amountByPeriod.get(k) ?? 0;
      const tva = a.valeurAcquisitionHT * (a.tauxTVA / 100);
      amountByPeriod.set(k, current + a.valeurAcquisitionHT + tva);
    });

    const amounts = periodKeys.map((k) => amountByPeriod.get(k) ?? 0);
    return { periodKeys, amounts };
  }

  static async getAchatsForRegistre(year: number): Promise<AchatRegistreEntry[]> {
    const [articles, categories] = await Promise.all([this.loadArticles(), this.loadCategories()]);
    const categoryById = new Map(categories.map((item) => [item.id, item.nom]));

    return articles
      .filter((item) => item.dateAcquisition.getFullYear() === year)
      .map((item) => {
        const tva = item.valeurAcquisitionHT * (item.tauxTVA / 100);
        return {
          id: item.id,
          date: item.dateAcquisition,
          designation: item.designation,
          fournisseur: item.fournisseur || '—',
          referenceFacture: item.factureRef || item.reference || item.id,
          categorie: item.categorieId ? categoryById.get(item.categorieId) || '—' : '—',
          modePaiement: item.modePaiement || 'autre',
          montantHT: item.valeurAcquisitionHT,
          tva,
          montantTTC: item.valeurAcquisitionHT + tva,
        } satisfies AchatRegistreEntry;
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  static generateId(prefix: 'ART' | 'CAT' | 'MVT' = 'ART'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private static serializeArticle(article: ArticleStock): ArticleStockSerialized {
    return {
      ...article,
      dateAcquisition: article.dateAcquisition.toISOString(),
      dateCession: article.dateCession?.toISOString(),
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
    };
  }

  private static deserializeArticle(article: ArticleStockSerialized): ArticleStock {
    return {
      ...article,
      dateAcquisition: new Date(article.dateAcquisition),
      dateCession: article.dateCession ? new Date(article.dateCession) : undefined,
      createdAt: new Date(article.createdAt),
      updatedAt: new Date(article.updatedAt),
    };
  }
}
