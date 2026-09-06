import React from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useZoom } from '../../contexts/ZoomContext';

const ZoomControl: React.FC = () => {
  const { t } = useTranslation();
  const { zoomLevel, zoomIn, zoomOut, resetZoom } = useZoom();

  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1">
      <button
        onClick={zoomOut}
        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-600 dark:text-gray-300"
        title={t('common.zoomOut')}
      >
        <ZoomOut size={16} />
      </button>
      <button
        onClick={resetZoom}
        className="min-w-[3.2rem] text-center text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-primary-600"
        title={t('common.zoomReset')}
      >
        {zoomLevel}%
      </button>
      <button
        onClick={zoomIn}
        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-600 dark:text-gray-300"
        title={t('common.zoomIn')}
      >
        <ZoomIn size={16} />
      </button>
      {zoomLevel !== 100 && (
        <button
          onClick={resetZoom}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-500 dark:text-gray-400"
          title={t('common.zoom100')}
        >
          <RotateCcw size={14} />
        </button>
      )}
    </div>
  );
};

export default ZoomControl;
