// Composant pour mettre en évidence un élément avec bordure animée

import React from 'react';
import '../../styles/guided-tour.css';

interface ElementHighlightProps {
  elementRect: DOMRect | null;
  visible: boolean;
}

const ElementHighlight: React.FC<ElementHighlightProps> = ({ elementRect, visible }) => {
  if (!visible || !elementRect) {
    return null;
  }

  return (
    <div
      className="tour-highlight"
      style={{
        top: elementRect.top - 4,
        left: elementRect.left - 4,
        width: elementRect.width + 8,
        height: elementRect.height + 8,
      }}
    />
  );
};

export default ElementHighlight;

