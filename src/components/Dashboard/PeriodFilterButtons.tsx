import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, CalendarDays, CalendarRange } from 'lucide-react';
import { PeriodRange } from '../../services/StatsService';

interface PeriodFilterButtonsProps {
  minDate: string;
  maxDate: string;
  start: string;
  end: string;
  weeks: PeriodRange[];
  months: PeriodRange[];
  years: PeriodRange[];
  onPeriodChange: (startIso: string, endIso: string) => void;
}

function rangeValue(r: PeriodRange): string {
  return `${r.start},${r.end}`;
}

function matchingValue(start: string, end: string, options: PeriodRange[]): string {
  const found = options.find((o) => o.start === start && o.end === end);
  return found ? rangeValue(found) : '';
}

const PeriodFilterButtons: React.FC<PeriodFilterButtonsProps> = React.memo(
  ({ minDate, maxDate, start, end, weeks, months, years, onPeriodChange }) => {
    const { t } = useTranslation();

    const weekOptions = useMemo(
      () =>
        weeks.map((w) => ({
          value: rangeValue(w),
          label: `${format(parseISO(w.start), 'dd/MM/yyyy')} → ${format(parseISO(w.end), 'dd/MM/yyyy')}`,
        })),
      [weeks]
    );
    const monthOptions = useMemo(
      () =>
        months.map((m) => ({
          value: rangeValue(m),
          label: format(parseISO(m.start), 'MMMM yyyy', { locale: fr }),
        })),
      [months]
    );
    const yearOptions = useMemo(
      () =>
        years.map((y) => ({
          value: rangeValue(y),
          label: format(parseISO(y.start), 'yyyy'),
        })),
      [years]
    );

    const handleSelect = (value: string) => {
      if (!value) return;
      const [s, e] = value.split(',');
      onPeriodChange(s, e);
    };

    const clampStart = (iso: string) => {
      const next = iso < minDate ? minDate : iso;
      onPeriodChange(next > end ? end : next, end);
    };
    const clampEnd = (iso: string) => {
      const next = iso > maxDate ? maxDate : iso;
      onPeriodChange(start, next < start ? start : next);
    };

    return (
      <div className="period-filter-buttons">
        <div className="period-filter-select-group">
          <label className="period-filter-label">{t('dashboard.dateToDate')}</label>
          <div className="period-date-to-date">
            <input
              type="date"
              className="period-filter-select"
              min={minDate}
              max={maxDate}
              value={start}
              onChange={(e) => clampStart(e.target.value)}
            />
            <span className="date-range-arrow">→</span>
            <input
              type="date"
              className="period-filter-select"
              min={minDate}
              max={maxDate}
              value={end}
              onChange={(e) => clampEnd(e.target.value)}
            />
          </div>
        </div>

        <div className="period-filter-select-group">
          <label className="period-filter-label">
            <CalendarRange size={14} />
            {t('dashboard.period.week')}
          </label>
          <select
            className="period-filter-select"
            value={matchingValue(start, end, weeks)}
            onChange={(e) => handleSelect(e.target.value)}
          >
            <option value="">{t('dashboard.selectWeek')}</option>
            {weekOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="period-filter-select-group">
          <label className="period-filter-label">
            <CalendarDays size={14} />
            {t('dashboard.period.month')}
          </label>
          <select
            className="period-filter-select"
            value={matchingValue(start, end, months)}
            onChange={(e) => handleSelect(e.target.value)}
          >
            <option value="">{t('dashboard.selectMonth')}</option>
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="period-filter-select-group">
          <label className="period-filter-label">
            <Calendar size={14} />
            {t('dashboard.period.year')}
          </label>
          <select
            className="period-filter-select"
            value={matchingValue(start, end, years)}
            onChange={(e) => handleSelect(e.target.value)}
          >
            <option value="">{t('dashboard.selectYear')}</option>
            {yearOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }
);

PeriodFilterButtons.displayName = 'PeriodFilterButtons';
export default PeriodFilterButtons;
