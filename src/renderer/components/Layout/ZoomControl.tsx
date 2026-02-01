import React from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearchPlus, faSearchMinus } from '@fortawesome/free-solid-svg-icons';
import { useZoom } from '../../hooks/useZoom';

const ZoomControl: React.FC = () => {
  const { t } = useTranslation();
  const { zoomLevel, zoomIn, zoomOut, canZoomIn, canZoomOut } = useZoom();

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
      <button
        onClick={zoomOut}
        disabled={!canZoomOut}
        className={`
          p-1 rounded transition-colors
          ${canZoomOut 
            ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer' 
            : 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
          }
        `}
        title={t('zoom.zoomOut')}
      >
        <FontAwesomeIcon icon={faSearchMinus} size="sm" />
      </button>
      
      <span 
        className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[3rem] text-center"
        title={t('zoom.currentZoom')}
      >
        {zoomLevel}%
      </span>
      
      <button
        onClick={zoomIn}
        disabled={!canZoomIn}
        className={`
          p-1 rounded transition-colors
          ${canZoomIn 
            ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer' 
            : 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
          }
        `}
        title={t('zoom.zoomIn')}
      >
        <FontAwesomeIcon icon={faSearchPlus} size="sm" />
      </button>
    </div>
  );
};

export default ZoomControl;
