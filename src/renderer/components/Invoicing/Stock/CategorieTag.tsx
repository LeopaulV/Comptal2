import React from 'react';

interface CategorieTagProps {
  label: string;
  color?: string;
}

/** Retourne true si la couleur est sombre (texte blanc conseillé) */
function isDarkColor(hex: string): boolean {
  if (!hex || !hex.startsWith('#') || hex.length < 4) return false;
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6) || '00', 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 0.5;
}

export const CategorieTag: React.FC<CategorieTagProps> = ({ label, color }) => {
  const bg = color || 'var(--invoicing-gray-200)';
  const textColor = color && isDarkColor(color) ? '#ffffff' : 'var(--invoicing-gray-900)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: bg,
        color: textColor,
      }}
    >
      {label}
    </span>
  );
};
