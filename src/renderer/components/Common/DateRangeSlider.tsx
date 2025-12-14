import React, { useEffect, useRef, useState } from 'react';
import noUiSlider from 'nouislider';
import type { API } from 'nouislider';
import 'nouislider/dist/nouislider.css';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subWeeks, subYears } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DateRangeSliderProps {
  minDate: Date;
  maxDate: Date;
  onChange: (startDate: Date, endDate: Date) => void;
}

const DateRangeSlider: React.FC<DateRangeSliderProps> = ({ minDate, maxDate, onChange }) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [slider, setSlider] = useState<API | null>(null);
  const [startDate, setStartDate] = useState<Date>(minDate);
  const [endDate, setEndDate] = useState<Date>(maxDate);
  const [weekOptions, setWeekOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [monthOptions, setMonthOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [yearOptions, setYearOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Détecter le thème sombre
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkDarkMode();
    
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  // Injecter les styles CSS personnalisés pour le slider
  useEffect(() => {
    const styleId = 'daterange-slider-custom-styles';
    let style = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }

    // Mettre à jour le contenu du style selon le thème
    style.textContent = `
      /* Styles pour le slider noUiSlider */
      .noUi-target {
        background: ${isDarkMode ? '#374151' : '#e5e7eb'};
        border: none;
        border-radius: 8px;
        box-shadow: ${isDarkMode ? 'inset 0 2px 4px rgba(0,0,0,0.3)' : 'inset 0 2px 4px rgba(0,0,0,0.1)'};
        transition: all 0.3s ease;
      }

      .noUi-connect {
        background: linear-gradient(135deg, #3a80d2 0%, #4a90e2 100%);
        border-radius: 8px;
        box-shadow: 0 2px 6px rgba(58, 128, 210, 0.4);
        transition: all 0.3s ease;
      }

      .noUi-handle {
        width: 20px !important;
        height: 20px !important;
        right: -10px !important;
        top: -5px !important;
        border: 3px solid ${isDarkMode ? '#1f2937' : '#ffffff'};
        border-radius: 50%;
        background: linear-gradient(135deg, #3a80d2 0%, #4a90e2 100%);
        box-shadow: 0 2px 8px rgba(58, 128, 210, 0.5), 0 0 0 4px ${isDarkMode ? 'rgba(58, 128, 210, 0.2)' : 'rgba(58, 128, 210, 0.1)'};
        cursor: grab;
        transition: all 0.2s ease;
      }

      .noUi-handle:active {
        cursor: grabbing;
        transform: scale(1.15);
        box-shadow: 0 4px 12px rgba(58, 128, 210, 0.6), 0 0 0 6px ${isDarkMode ? 'rgba(58, 128, 210, 0.3)' : 'rgba(58, 128, 210, 0.2)'};
      }

      .noUi-handle:hover {
        transform: scale(1.1);
        box-shadow: 0 3px 10px rgba(58, 128, 210, 0.6), 0 0 0 5px ${isDarkMode ? 'rgba(58, 128, 210, 0.25)' : 'rgba(58, 128, 210, 0.15)'};
      }

      .noUi-handle::before,
      .noUi-handle::after {
        display: none;
      }

      .noUi-pips {
        height: 30px;
      }

      .noUi-marker {
        background: ${isDarkMode ? '#6b7280' : '#9ca3af'};
        transition: all 0.2s ease;
      }

      .noUi-marker:hover {
        background: ${isDarkMode ? '#9ca3af' : '#6b7280'};
      }

      .noUi-value {
        color: ${isDarkMode ? '#d1d5db' : '#4b5563'};
        font-size: 9px;
        font-weight: 500;
        margin-top: 4px;
      }

      .noUi-value-sub {
        color: ${isDarkMode ? '#9ca3af' : '#6b7280'};
      }
    `;

    return () => {
      // Ne pas supprimer le style ici car il peut être réutilisé
    };
  }, [isDarkMode]);

  useEffect(() => {
    if (sliderRef.current && !slider) {
      // Vérifier si le slider n'est pas déjà initialisé
      if ((sliderRef.current as any).noUiSlider) {
        setSlider((sliderRef.current as any).noUiSlider);
        return;
      }
      
      const sliderInstance = noUiSlider.create(sliderRef.current, {
        start: [minDate.getTime(), maxDate.getTime()],
        connect: true,
        range: {
          'min': minDate.getTime(),
          'max': maxDate.getTime()
        },
        step: 86400000, // 1 jour en millisecondes
        tooltips: false,
        pips: {
          mode: 'count' as any,
          values: 5,
          density: 4,
          format: {
            to: (value) => format(new Date(value), 'dd/MM/yyyy', { locale: fr })
          }
        }
      });

      sliderInstance.on('update', (values) => {
        // Mettre à jour l'affichage uniquement (pas de callback)
        const start = new Date(Number(values[0]));
        const end = new Date(Number(values[1]));
        setStartDate(start);
        setEndDate(end);
      });

      sliderInstance.on('change', (values) => {
        // Déclencher le callback seulement quand l'utilisateur a fini de déplacer
        const start = new Date(Number(values[0]));
        const end = new Date(Number(values[1]));
        onChange(start, end);
      });

      setSlider(sliderInstance);

      // Générer les options de sélection
      generateWeekOptions();
      generateMonthOptions();
      generateYearOptions();
    }

    return () => {
      if (slider && sliderRef.current) {
        try {
          slider.destroy();
        } catch (e) {
          // Slider déjà détruit, ignorer l'erreur
        }
      }
    };
  }, [slider]);

  const generateWeekOptions = () => {
    const options: Array<{ value: string; label: string }> = [];
    let currentDate = new Date();
    
    for (let i = 0; i < 52 && currentDate > minDate; i++) {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      
      options.push({
        value: `${format(weekStart, 'dd/MM/yyyy')},${format(weekEnd, 'dd/MM/yyyy')}`,
        label: `Semaine ${i + 1}: ${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM')}`
      });
      
      currentDate = subWeeks(currentDate, 1);
    }
    
    setWeekOptions(options);
  };

  const generateMonthOptions = () => {
    const options: Array<{ value: string; label: string }> = [];
    let currentDate = new Date();
    
    for (let i = 0; i < 24 && currentDate > minDate; i++) {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      
      options.push({
        value: `${format(monthStart, 'dd/MM/yyyy')},${format(monthEnd, 'dd/MM/yyyy')}`,
        label: format(currentDate, 'MMMM yyyy', { locale: fr })
      });
      
      currentDate = subMonths(currentDate, 1);
    }
    
    setMonthOptions(options);
  };

  const generateYearOptions = () => {
    const options: Array<{ value: string; label: string }> = [];
    let currentDate = new Date();
    
    while (currentDate.getFullYear() >= minDate.getFullYear()) {
      const yearStart = startOfYear(currentDate);
      const yearEnd = endOfYear(currentDate);
      
      options.push({
        value: `${format(yearStart, 'dd/MM/yyyy')},${format(yearEnd, 'dd/MM/yyyy')}`,
        label: currentDate.getFullYear().toString()
      });
      
      currentDate = subYears(currentDate, 1);
    }
   
    setYearOptions(options);
  };

  const handleSelectChange = (value: string) => {
    if (!value || !slider) return;
    
    const [start, end] = value.split(',');
    const [startDay, startMonth, startYear] = start.split('/');
    const [endDay, endMonth, endYear] = end.split('/');
    
    const startDate = new Date(Number(startYear), Number(startMonth) - 1, Number(startDay));
    const endDate = new Date(Number(endYear), Number(endMonth) - 1, Number(endDay));
    
    // Mettre à jour le slider (cela déclenchera l'événement 'change')
    slider.set([startDate.getTime(), endDate.getTime()]);
    
    // Mettre à jour les états locaux
    setStartDate(startDate);
    setEndDate(endDate);
    
    // Déclencher le callback explicitement
    onChange(startDate, endDate);
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg dark:shadow-xl transition-all duration-300 hover:shadow-xl dark:hover:shadow-2xl w-full overflow-hidden">
      {/* Slider avec conteneur stylisé */}
      <div className="mb-4 px-2">
        <div 
          ref={sliderRef} 
          className="slider-container w-full" 
          style={{ height: '12px', marginTop: '10px', marginBottom: '30px' }}
        ></div>
      </div>
      
      {/* Badge stylisé pour l'affichage de la plage */}
      <div className="flex items-center justify-center">
        <div className="inline-flex flex-wrap items-center justify-center gap-2 mt-2 py-1 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 border-2 border-primary-200 dark:border-primary-700 rounded-xl shadow-md dark:shadow-lg transition-all duration-300 animate-fade-in hover:shadow-lg dark:hover:shadow-xl max-w-full">
          <div className="flex items-center gap-2 text-primary-700 dark:text-primary-300">
            <i className="fas fa-calendar-check text-[10px]"></i>
            <span className="text-xs font-medium uppercase tracking-wide"></span>
          </div>
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 px-2 py-1 bg-white dark:bg-gray-700 rounded-lg shadow-sm dark:shadow-md text-center transition-all duration-200 whitespace-nowrap">
            {format(startDate, 'dd/MM/yyyy', { locale: fr })}
          </div>
          <div className="text-primary-600 dark:text-primary-400 font-bold text-[10px]">→</div>
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 px-2 py-1 bg-white dark:bg-gray-700 rounded-lg shadow-sm dark:shadow-md text-center transition-all duration-200 whitespace-nowrap">
            {format(endDate, 'dd/MM/yyyy', { locale: fr })}
          </div>
          <div className="flex items-center gap-2 text-primary-700 dark:text-primary-300">
            <span className="text-xs font-medium uppercase tracking-wide"></span>
            <i className="fas fa-calendar-check text-[10px]"></i>
          </div>
        </div>
      </div>
      
      {/* Sélecteurs améliorés avec icônes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <div className="relative group min-w-0">
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-primary-500 dark:text-primary-400 z-10 pointer-events-none transition-colors duration-200">
            <i className="fas fa-calendar-week text-[10px]"></i>
          </div>
          <select
            onChange={(e) => handleSelectChange(e.target.value)}
            className="w-full pl-8 mt-1 pr-3 py-1.5 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:border-primary-400 transition-all duration-200 cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 shadow-sm hover:shadow-md dark:shadow-md dark:hover:shadow-lg appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%233a80d2%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpolyline points=%226 9 12 15 18 9%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat"
            defaultValue=""
          >
            <option value="" className="font-medium">Semaine</option>
            {weekOptions.map((option, index) => (
              <option key={index} value={option.value} className="py-2">{option.label}</option>
            ))}
          </select>
        </div>
        
        <div className="relative group min-w-0">
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-primary-500 dark:text-primary-400 z-10 pointer-events-none transition-colors duration-200">
            <i className="fas fa-calendar-alt text-[10px]"></i>
          </div>
          <select
            onChange={(e) => handleSelectChange(e.target.value)}
            className="w-full pl-8 mt-1 pr-3 py-1.5 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:border-primary-400 transition-all duration-200 cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 shadow-sm hover:shadow-md dark:shadow-md dark:hover:shadow-lg appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%233a80d2%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpolyline points=%226 9 12 15 18 9%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat"
            defaultValue=""
          >
            <option value="" className="font-medium">Mois</option>
            {monthOptions.map((option, index) => (
              <option key={index} value={option.value} className="py-2">{option.label}</option>
            ))}
          </select>
        </div>
        
        <div className="relative group min-w-0">
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-primary-500 dark:text-primary-400 z-10 pointer-events-none transition-colors duration-200">
            <i className="fas fa-calendar text-[10px]"></i>
          </div>
          <select
            onChange={(e) => handleSelectChange(e.target.value)}
            className="w-full pl-8 mt-1 pr-3 py-1.5 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:border-primary-400 transition-all duration-200 cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 shadow-sm hover:shadow-md dark:shadow-md dark:hover:shadow-lg appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%233a80d2%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpolyline points=%226 9 12 15 18 9%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat"
            defaultValue=""
          >
            <option value="" className="font-medium">Année</option>
            {yearOptions.map((option, index) => (
              <option key={index} value={option.value} className="py-2">{option.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default DateRangeSlider;

