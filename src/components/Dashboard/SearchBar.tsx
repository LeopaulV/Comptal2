import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = React.memo(({ value, onChange }) => {
  const { t } = useTranslation();
  const [local, setLocal] = useState(value);

  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    const timer = window.setTimeout(() => onChange(local), 300);
    return () => window.clearTimeout(timer);
  }, [local, onChange]);

  return (
    <label className="ct-label relative">
      {t('common.search')}
      <span className="relative block mt-1">
        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="ct-input w-full pl-7"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
        />
      </span>
    </label>
  );
});

SearchBar.displayName = 'SearchBar';
export default SearchBar;
