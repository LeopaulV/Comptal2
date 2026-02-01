// Carte flottante avec flèche pointant vers l'élément cible

import React from 'react';
import '../../styles/guided-tour.css';

interface TourStepProps {
  title: string;
  description: string;
  elementRect: DOMRect | null;
  position: 'top' | 'bottom' | 'left' | 'right';
  visible: boolean;
}

const TourStep: React.FC<TourStepProps> = ({
  title,
  description,
  elementRect,
  position,
  visible,
}) => {
  const isDark = document.documentElement.classList.contains('dark');

  if (!visible || !elementRect) {
    return null;
  }

  // Calculer la position de la carte
  const cardWidth = 320;
  const cardHeight = 180;
  const spacing = 16;

  let cardTop = 0;
  let cardLeft = 0;
  let arrowClass = '';

  switch (position) {
    case 'top':
      cardTop = elementRect.top - cardHeight - spacing;
      cardLeft = elementRect.left + elementRect.width / 2 - cardWidth / 2;
      arrowClass = 'bottom';
      break;
    case 'bottom':
      cardTop = elementRect.bottom + spacing;
      cardLeft = elementRect.left + elementRect.width / 2 - cardWidth / 2;
      arrowClass = 'top';
      break;
    case 'left':
      cardTop = elementRect.top + elementRect.height / 2 - cardHeight / 2;
      cardLeft = elementRect.left - cardWidth - spacing;
      arrowClass = 'right';
      break;
    case 'right':
      cardTop = elementRect.top + elementRect.height / 2 - cardHeight / 2;
      cardLeft = elementRect.right + spacing;
      arrowClass = 'left';
      break;
  }

  // Ajuster si la carte sort de l'écran
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (cardLeft < 16) cardLeft = 16;
  if (cardLeft + cardWidth > viewportWidth - 16) {
    cardLeft = viewportWidth - cardWidth - 16;
  }
  if (cardTop < 16) cardTop = 16;
  if (cardTop + cardHeight > viewportHeight - 16) {
    cardTop = viewportHeight - cardHeight - 16;
  }

  return (
    <div
      className={`tour-step-card ${isDark ? 'dark' : ''}`}
      style={{
        top: `${cardTop}px`,
        left: `${cardLeft}px`,
      }}
    >
      {/* Flèche */}
      <div className={`tour-arrow ${arrowClass} ${isDark ? 'dark' : ''}`} />

      {/* Contenu */}
      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
        {title}
      </h4>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {description}
      </p>
    </div>
  );
};

export default TourStep;

