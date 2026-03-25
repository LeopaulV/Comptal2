export interface SireneEntrepriseResult {
  siren?: string;
  siret?: string;
  nom_complet?: string;
  denomination?: string;
  sigle?: string;
  nature_juridique?: string;
  activite_principale?: string;
  adresse?: string;
  code_postal?: string;
  commune?: string;
}

export interface SireneSearchResponse {
  results: SireneEntrepriseResult[];
  total_results: number;
  page: number;
  per_page: number;
}

export class SireneAPIService {
  private static readonly BASE_URL = 'https://recherche-entreprises.api.gouv.fr/search';

  static async searchEntreprises(query: string, page = 1, perPage = 10): Promise<SireneSearchResponse> {
    if (!query || query.trim().length < 2) {
      return { results: [], total_results: 0, page, per_page: perPage };
    }
    const url = `${this.BASE_URL}?q=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erreur API SIRENE: ${response.status}`);
    }
    return response.json();
  }

  static async getEntrepriseBySiret(siret: string): Promise<SireneEntrepriseResult | null> {
    const cleaned = siret.replace(/\s+/g, '');
    if (!/^\d{14}$/.test(cleaned)) {
      return null;
    }
    const data = await this.searchEntreprises(cleaned, 1, 1);
    return data.results?.[0] || null;
  }
}
