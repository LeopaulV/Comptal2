import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SireneAPIService, SireneEntrepriseResult } from '../../../services/SireneAPIService';

interface EntrepriseSearchProps {
  onSelect: (entreprise: SireneEntrepriseResult) => void;
}

export const EntrepriseSearch: React.FC<EntrepriseSearchProps> = ({ onSelect }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SireneEntrepriseResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const search = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      try {
        const data = await SireneAPIService.searchEntreprises(query, 1, 5);
        setResults(data.results || []);
      } catch (error) {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };
    const timeout = setTimeout(search, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="invoicing-search-box">
      <label>
        {t('invoicing.clients.entrepriseSearch')}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('invoicing.clients.entreprisePlaceholder')}
        />
      </label>
      {isLoading && <div className="invoicing-loading">{t('invoicing.clients.loading')}</div>}
      <div className="invoicing-search-results">
        {results.map((result) => (
          <button
            key={`${result.siret}-${result.siren}-${result.nom_complet}`}
            type="button"
            className="invoicing-search-result"
            onClick={() => onSelect(result)}
          >
            <div className="name">{result.nom_complet || result.denomination}</div>
            <div className="meta">{result.siret || result.siren}</div>
          </button>
        ))}
      </div>
    </div>
  );
};
