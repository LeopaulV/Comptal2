import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subWeeks, subYears } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PeriodFilterButtonsProps {
  minDate: Date;
  maxDate: Date;
  onPeriodChange: (startDate: Date, endDate: Date) => void;
}

const PeriodFilterButtons: React.FC<PeriodFilterButtonsProps> = ({ minDate, onPeriodChange }) => {
  const { t } = useTranslation();
  const [weekOptions, setWeekOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [monthOptions, setMonthOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [yearOptions, setYearOptions] = useState<Array<{ value: string; label: string }>>([]);

  // Générer les options
  useEffect(() => {
    // Générer les options de semaine
    const weekOpts: Array<{ value: string; label: string }> = [];
    let currentDate = new Date();
    
    for (let i = 0; i < 52 && currentDate > minDate; i++) {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      
      weekOpts.push({
        value: `${format(weekStart, 'dd/MM/yyyy')},${format(weekEnd, 'dd/MM/yyyy')}`,
        label: `Semaine ${i + 1}: ${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM')}`
      });
      
      currentDate = subWeeks(currentDate, 1);
    }
    setWeekOptions(weekOpts);

    // Générer les options de mois
    const monthOpts: Array<{ value: string; label: string }> = [];
    currentDate = new Date();
    
    for (let i = 0; i < 24 && currentDate > minDate; i++) {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      
      monthOpts.push({
        value: `${format(monthStart, 'dd/MM/yyyy')},${format(monthEnd, 'dd/MM/yyyy')}`,
        label: format(currentDate, 'MMMM yyyy', { locale: fr })
      });
      
      currentDate = subMonths(currentDate, 1);
    }
    setMonthOptions(monthOpts);

    // Générer les options d'année
    const yearOpts: Array<{ value: string; label: string }> = [];
    currentDate = new Date();
    
    while (currentDate.getFullYear() >= minDate.getFullYear()) {
      const yearStart = startOfYear(currentDate);
      const yearEnd = endOfYear(currentDate);
      
      yearOpts.push({
        value: `${format(yearStart, 'dd/MM/yyyy')},${format(yearEnd, 'dd/MM/yyyy')}`,
        label: currentDate.getFullYear().toString()
      });
      
      currentDate = subYears(currentDate, 1);
    }
    setYearOptions(yearOpts);
  }, [minDate]);

  const handleSelectChange = (value: string, _type: 'week' | 'month' | 'year') => {
    if (!value) return;
    
    const [start, end] = value.split(',');
    const [startDay, startMonth, startYear] = start.split('/');
    const [endDay, endMonth, endYear] = end.split('/');
    
    const startDate = new Date(Number(startYear), Number(startMonth) - 1, Number(startDay));
    const endDate = new Date(Number(endYear), Number(endMonth) - 1, Number(endDay));
    
    onPeriodChange(startDate, endDate);
  };

  return (
    <div className="period-filter-buttons">
      <div className="period-filter-select-group">
        <label className="period-filter-label">
          <i className="fas fa-calendar-week"></i>
          {t('dashboard.week', 'Semaine')}
        </label>
        <select
          className="period-filter-select"
          onChange={(e) => handleSelectChange(e.target.value, 'week')}
          defaultValue=""
        >
          <option value="">{t('dashboard.selectWeek', 'Sélectionner une semaine')}</option>
          {weekOptions.map((option, index) => (
            <option key={index} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="period-filter-select-group">
        <label className="period-filter-label">
          <i className="fas fa-calendar-alt"></i>
          {t('dashboard.month', 'Mois')}
        </label>
        <select
          className="period-filter-select"
          onChange={(e) => handleSelectChange(e.target.value, 'month')}
          defaultValue=""
        >
          <option value="">{t('dashboard.selectMonth', 'Sélectionner un mois')}</option>
          {monthOptions.map((option, index) => (
            <option key={index} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="period-filter-select-group">
        <label className="period-filter-label">
          <i className="fas fa-calendar"></i>
          {t('dashboard.year', 'Année')}
        </label>
        <select
          className="period-filter-select"
          onChange={(e) => handleSelectChange(e.target.value, 'year')}
          defaultValue=""
        >
          <option value="">{t('dashboard.selectYear', 'Sélectionner une année')}</option>
          {yearOptions.map((option, index) => (
            <option key={index} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default PeriodFilterButtons;
