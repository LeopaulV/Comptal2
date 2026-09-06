import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Power } from 'lucide-react';
import { WindowService } from '../../services/WindowService';

const QuitAppButton: React.FC = () => {
  const { t } = useTranslation();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => WindowService.subscribeFullscreen(setIsFullscreen), []);

  if (!isFullscreen) return null;

  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
      style={{ backgroundColor: 'var(--invoicing-danger)' }}
      onClick={() => void WindowService.quit()}
      title={t('navigation.quitTitle')}
    >
      <Power size={18} />
      {t('navigation.quit')}
    </button>
  );
};

export default QuitAppButton;
