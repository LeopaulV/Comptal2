import React, { useEffect, useRef, useState } from 'react';
import noUiSlider from 'nouislider';
import type { API } from 'nouislider';
import 'nouislider/dist/nouislider.css';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DateRangeSliderProps {
  minDate: Date;
  maxDate: Date;
  onChange: (startDate: Date, endDate: Date) => void;
  startDate?: Date;
  endDate?: Date;
}

const DateRangeSlider: React.FC<DateRangeSliderProps> = ({ minDate, maxDate, onChange, startDate: controlledStartDate, endDate: controlledEndDate }) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [slider, setSlider] = useState<API | null>(null);
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

  // Initialiser le slider
  useEffect(() => {
    if (sliderRef.current && !slider) {
      // Vérifier si le slider n'est pas déjà initialisé
      if ((sliderRef.current as any).noUiSlider) {
        setSlider((sliderRef.current as any).noUiSlider);
        return;
      }
      
      const initialStart = controlledStartDate?.getTime() || minDate.getTime();
      const initialEnd = controlledEndDate?.getTime() || maxDate.getTime();
      
      const sliderInstance = noUiSlider.create(sliderRef.current, {
        start: [initialStart, initialEnd],
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

      sliderInstance.on('update', () => {
        // Mettre à jour l'affichage uniquement (pas de callback)
        // Les valeurs sont mises à jour visuellement par le slider
      });

      sliderInstance.on('change', (values) => {
        // Déclencher le callback seulement quand l'utilisateur a fini de déplacer
        const start = new Date(Number(values[0]));
        const end = new Date(Number(values[1]));
        onChange(start, end);
      });

      setSlider(sliderInstance);
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

  // Synchroniser le slider avec les valeurs contrôlées
  useEffect(() => {
    if (slider && controlledStartDate && controlledEndDate) {
      const startTime = controlledStartDate.getTime();
      const endTime = controlledEndDate.getTime();
      const currentValues = slider.get() as number[];
      
      // Mettre à jour seulement si les valeurs sont différentes (tolérance de 1 jour)
      const tolerance = 86400000; // 1 jour en millisecondes
      const startDiff = Math.abs(currentValues[0] - startTime);
      const endDiff = Math.abs(currentValues[1] - endTime);
      
      if (startDiff > tolerance || endDiff > tolerance) {
        slider.set([startTime, endTime], false); // false = ne pas déclencher les événements
      }
    }
  }, [slider, controlledStartDate, controlledEndDate]);

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg dark:shadow-xl transition-all duration-300 hover:shadow-xl dark:hover:shadow-2xl w-full overflow-hidden">
      {/* Slider avec conteneur stylisé */}
      <div className="px-2">
        <div 
          ref={sliderRef} 
          className="slider-container w-full" 
          style={{ height: '12px', marginTop: '10px', marginBottom: '30px' }}
        ></div>
      </div>
    </div>
  );
};

export default DateRangeSlider;

