import React from 'react';
import { useTranslation } from 'react-i18next';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { ChartGranularity } from '../../types/projection';
import { getNextGranularity, getPreviousGranularity } from '../../utils/periodKeys';

interface ChartGranularityZoomProps {
  granularity: ChartGranularity;
  onChange: (granularity: ChartGranularity) => void;
}

/** Loupe +/- pour changer la granularité de l'axe X (jour → semaine → mois → …). */
const ChartGranularityZoom: React.FC<ChartGranularityZoomProps> = ({ granularity, onChange }) => {
  const { t } = useTranslation();
  const canZoomIn = getNextGranularity(granularity) !== null;
  const canZoomOut = getPreviousGranularity(granularity) !== null;

  return (
    <div className="chart-toolbar-zoom">
      <div className="chart-toolbar-zoom-buttons">
        <button
          type="button"
          className="chart-toolbar-btn"
          onClick={() => {
            const prev = getPreviousGranularity(granularity);
            if (prev) onChange(prev);
          }}
          disabled={!canZoomOut}
          title={t('financeGlobal.zoomOut')}
          aria-label={t('financeGlobal.zoomOut')}
        >
          <ZoomOut size={18} />
        </button>
        <span className="chart-toolbar-granularity">{t(`finance.gran.${granularity}`)}</span>
        <button
          type="button"
          className="chart-toolbar-btn"
          onClick={() => {
            const next = getNextGranularity(granularity);
            if (next) onChange(next);
          }}
          disabled={!canZoomIn}
          title={t('financeGlobal.zoomIn')}
          aria-label={t('financeGlobal.zoomIn')}
        >
          <ZoomIn size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChartGranularityZoom;
