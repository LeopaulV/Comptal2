import React from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faTimes } from '@fortawesome/free-solid-svg-icons';

interface PeriodFilterPanelProps {
  startDate: string | null;
  endDate: string | null;
  onPeriodChange: (startDate: string | null, endDate: string | null) => void;
}

const PeriodFilterPanel: React.FC<PeriodFilterPanelProps> = ({
  startDate,
  endDate,
  onPeriodChange,
}) => {
  const { t } = useTranslation();

  // Convertir dd/MM/yyyy en YYYY-MM-DD pour l'input date
  const formatDateForInput = (dateStr: string | null): string => {
    if (!dateStr) return '';
    const [day, month, year] = dateStr.split('/');
    if (day && month && year) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return '';
  };

  // Convertir YYYY-MM-DD en dd/MM/yyyy
  const formatDateFromInput = (dateStr: string): string => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    if (year && month && day) {
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
    return '';
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formattedDate = value ? formatDateFromInput(value) : null;
    onPeriodChange(formattedDate, endDate);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formattedDate = value ? formatDateFromInput(value) : null;
    onPeriodChange(startDate, formattedDate);
  };

  const handleReset = () => {
    onPeriodChange(null, null);
  };

  const hasActiveFilter = startDate !== null || endDate !== null;

  return (
    <div className="period-filters">
      <div className="filter-actions">
        <button
          className="filter-button"
          onClick={handleReset}
          disabled={!hasActiveFilter}
          title={t('edition.resetPeriod')}
        >
          <FontAwesomeIcon icon={faTimes} />
          {t('edition.resetPeriod')}
        </button>
      </div>

      <div className="period-date-inputs">
        <div className="period-date-group">
          <label htmlFor="period-start-date" className="period-date-label">
            <FontAwesomeIcon icon={faCalendarAlt} />
            {t('edition.startDate')}
          </label>
          <input
            type="date"
            id="period-start-date"
            className="period-date-input"
            value={formatDateForInput(startDate)}
            onChange={handleStartDateChange}
            placeholder={t('edition.periodPlaceholder')}
          />
        </div>

        <div className="period-date-group">
          <label htmlFor="period-end-date" className="period-date-label">
            <FontAwesomeIcon icon={faCalendarAlt} />
            {t('edition.endDate')}
          </label>
          <input
            type="date"
            id="period-end-date"
            className="period-date-input"
            value={formatDateForInput(endDate)}
            onChange={handleEndDateChange}
            placeholder={t('edition.periodPlaceholder')}
          />
        </div>
      </div>

      {hasActiveFilter && (
        <div className="period-filter-info">
          <span className="period-filter-text">
            {startDate && endDate
              ? `${startDate} - ${endDate}`
              : startDate
              ? `${t('edition.startDate')}: ${startDate}`
              : `${t('edition.endDate')}: ${endDate}`}
          </span>
        </div>
      )}
    </div>
  );
};

export default PeriodFilterPanel;
