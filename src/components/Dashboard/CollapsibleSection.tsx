import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultOpen = true,
  icon,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="dashboard-collapsible-section">
      <div className="dashboard-collapsible-header">
        <div className="dashboard-collapsible-title">
          {icon}
          {title}
        </div>
        <button
          type="button"
          className="dashboard-collapsible-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          title={open ? t('dashboard.collapse') : t('dashboard.expand')}
        >
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>
      {open && children}
    </section>
  );
};

export default CollapsibleSection;
