import React from 'react';
import { useTranslation } from 'react-i18next';
import { Hourglass } from 'lucide-react';

interface ComingSoonProps {
  titleKey: string;
}

/** Page temporaire : sera remplacée par l'implémentation du plan correspondant. */
const ComingSoon: React.FC<ComingSoonProps> = ({ titleKey }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--invoicing-gray-900)' }}>
        {t(titleKey)}
      </h1>
      <div className="ct-card flex flex-col items-center justify-center py-16 gap-4">
        <Hourglass size={40} style={{ color: 'var(--invoicing-gray-400)' }} />
        <p className="text-sm" style={{ color: 'var(--invoicing-gray-500)' }}>
          {t('common.comingSoon')}
        </p>
      </div>
    </div>
  );
};

export default ComingSoon;
