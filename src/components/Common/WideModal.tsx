import React from 'react';
import { X } from 'lucide-react';

interface WideModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  layer?: 'base' | 'stack' | 'editor';
  subtitle?: string;
  lead?: React.ReactNode;
  className?: string;
}

const WideModal: React.FC<WideModalProps> = ({
  isOpen,
  title,
  onClose,
  children,
  layer = 'base',
  subtitle,
  lead,
  className,
}) => {
  if (!isOpen) return null;
  return (
    <div
      className={`inv-wide-modal inv-wide-modal-${layer}`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`inv-wide-modal-card${className ? ` ${className}` : ''}`}>
        <div className="inv-wide-modal-head">
          <div className="inv-wide-modal-head-main">
            {lead}
            <div className="inv-wide-modal-head-text">
              <h2>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>
          <button className="ct-btn-secondary inv-wide-modal-close" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default WideModal;
