import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Upload, CheckCircle2, SearchX } from 'lucide-react';

interface EditionTablePlaceholderProps {
  variant: 'empty' | 'allCategorized' | 'noResults';
}

const EditionTablePlaceholder: React.FC<EditionTablePlaceholderProps> = ({ variant }) => {
  const { t } = useTranslation();

  const config = {
    empty: {
      icon: Upload,
      color: 'var(--invoicing-gray-400)',
      title: t('edition.emptyTitle'),
      text: t('edition.empty'),
      link: { to: '/upload', label: t('edition.goToUpload') },
    },
    allCategorized: {
      icon: CheckCircle2,
      color: 'var(--invoicing-success)',
      title: t('edition.allCategorizedTitle'),
      text: t('edition.allCategorized'),
      link: null,
    },
    noResults: {
      icon: SearchX,
      color: 'var(--invoicing-gray-400)',
      title: t('edition.noResultsTitle'),
      text: t('edition.noResults'),
      link: null,
    },
  }[variant];

  const Icon = config.icon;

  return (
    <div className="edition-excel-scroller edition-table-placeholder">
      <Icon size={48} strokeWidth={1.5} style={{ color: config.color }} />
      <h3 className="edition-table-placeholder-title">{config.title}</h3>
      <p className="edition-table-placeholder-text">{config.text}</p>
      {config.link && (
        <Link to={config.link.to} className="edition-table-placeholder-link">
          {config.link.label}
        </Link>
      )}
    </div>
  );
};

export default EditionTablePlaceholder;
