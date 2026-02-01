import React from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSliders,
  faBoxesStacked,
  faClipboardList,
} from '@fortawesome/free-solid-svg-icons';

export type InvoicingTab = 'gestion' | 'parametres' | 'postes';

interface InvoicingMenuProps {
  activeTab: InvoicingTab;
  onChangeTab: (tab: InvoicingTab) => void;
}

export const InvoicingMenu: React.FC<InvoicingMenuProps> = ({ activeTab, onChangeTab }) => {
  const { t } = useTranslation();
  const items: Array<{ id: InvoicingTab; icon: any; label: string }> = [
    { id: 'gestion', icon: faClipboardList, label: t('invoicing.menu.gestion') },
    { id: 'parametres', icon: faSliders, label: t('invoicing.menu.settings') },
    { id: 'postes', icon: faBoxesStacked, label: t('invoicing.menu.postes') },
  ];

  return (
    <aside className="invoicing-menu">
      <div className="invoicing-menu-header">{t('invoicing.menu.title')}</div>
      <div className="invoicing-menu-items">
        {items.map((item) => (
          <button
            key={item.id}
            className={`invoicing-menu-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onChangeTab(item.id)}
            type="button"
          >
            <FontAwesomeIcon icon={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
};
