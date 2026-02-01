import React from 'react';

interface ChevronToggleProps {
  isOpen: boolean;
  onClick: () => void;
}

export const ChevronToggle: React.FC<ChevronToggleProps> = ({ isOpen, onClick }) => (
  <button
    type="button"
    className="invoicing-toggle"
    onClick={onClick}
    aria-label={isOpen ? 'Réduire' : 'Dérouler'}
  >
    {isOpen ? (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    ) : (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    )}
  </button>
);
