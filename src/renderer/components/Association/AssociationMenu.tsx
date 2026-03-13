import React from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSliders,
  faBoxesStacked,
  faClipboardList,
  faBookOpen,
} from '@fortawesome/free-solid-svg-icons';

export type AssociationTab = 'gestion' | 'parametres' | 'postes' | 'registre';

interface AssociationMenuProps {
  activeTab: AssociationTab;
  onChangeTab: (tab: AssociationTab) => void;
}

export const AssociationMenu: React.FC<AssociationMenuProps> = ({ activeTab, onChangeTab }) => {
  const { t } = useTranslation();
  const items: Array<{ id: AssociationTab; icon: any; label: string }> = [
    { id: 'gestion', icon: faClipboardList, label: t('association.menu.gestion') },
    { id: 'registre', icon: faBookOpen, label: t('association.menu.registre') },
    { id: 'parametres', icon: faSliders, label: t('association.menu.settings') },
    { id: 'postes', icon: faBoxesStacked, label: t('association.menu.postes') },
  ];

  return (
    <aside className="association-menu">
      <div className="association-menu-header">{t('association.menu.title')}</div>
      <div className="association-menu-items">
        {items.map((item) => (
          <button
            key={item.id}
            className={`association-menu-item ${activeTab === item.id ? 'active' : ''}`}
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
