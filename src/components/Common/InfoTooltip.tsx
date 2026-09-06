import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface InfoTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ content, children }) => {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const updatePos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top });
  }, []);

  useEffect(() => {
    if (!visible) return;
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [visible, updatePos]);

  return (
    <>
      <span
        ref={triggerRef}
        className="info-tooltip-trigger"
        onMouseEnter={() => {
          updatePos();
          setVisible(true);
        }}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => {
          updatePos();
          setVisible(true);
        }}
        onBlur={() => setVisible(false)}
        tabIndex={0}
      >
        {children}
      </span>
      {visible &&
        createPortal(
          <div
            className="info-tooltip-portal"
            role="tooltip"
            style={{
              left: pos.x,
              top: pos.y - 8,
              transform: 'translate(-50%, -100%)',
            }}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
};

export default InfoTooltip;
