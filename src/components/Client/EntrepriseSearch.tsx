import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SireneAPIService, SireneEntrepriseResult } from '../../services/SireneAPIService';
import { Logger } from '../../services/logger';

interface EntrepriseSearchProps {
  onSelect: (result: SireneEntrepriseResult) => void;
}

const EntrepriseSearch: React.FC<EntrepriseSearchProps> = ({ onSelect }) => {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SireneEntrepriseResult[]>([]);

  const search = async () => {
    try {
      const data = await SireneAPIService.searchEntreprises(q, 1, 8);
      setResults(data.results ?? []);
    } catch (err) {
      Logger.error('EntrepriseSearch.search', err);
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          className="inv-search flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('org.sirenePlaceholder')}
        />
        <button type="button" className="ct-btn-secondary" onClick={() => void search()}>
          {t('org.sireneSearch')}
        </button>
      </div>
      {results.map((r, i) => (
        <button
          key={`${r.siret}-${i}`}
          type="button"
          className="block w-full text-left text-sm py-1"
          onClick={() => onSelect(r)}
        >
          {r.nom_complet || r.denomination} — {r.siret} — {r.commune}
        </button>
      ))}
    </div>
  );
};

export default EntrepriseSearch;
