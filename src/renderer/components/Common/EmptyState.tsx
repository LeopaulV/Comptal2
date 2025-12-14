import React from 'react';
import { Link } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from './Button';

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  actionPath?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  actionLabel,
  actionPath = '/upload',
  onAction,
}) => {
  const { t } = useTranslation();

  const defaultTitle = title || t('emptyState.title', 'Aucune donnée disponible');
  const defaultMessage = message || t('emptyState.message', 'Importez des fichiers CSV pour commencer à utiliser Comptal2');
  const defaultActionLabel = actionLabel || t('emptyState.action', 'Importer des données');

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="mb-6">
        <Inbox className="w-24 h-24 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2 text-center">
        {defaultTitle}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-8 text-center max-w-md">
        {defaultMessage}
      </p>
      {onAction ? (
        <Button onClick={onAction} variant="primary" size="lg">
          {defaultActionLabel}
        </Button>
      ) : (
        <Link to={actionPath}>
          <Button variant="primary" size="lg">
            {defaultActionLabel}
          </Button>
        </Link>
      )}
    </div>
  );
};

export default EmptyState;

