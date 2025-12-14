import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChartLine, 
  faUpload, 
  faEdit, 
  faChartBar, 
  faCog,
  faChevronLeft,
  faChevronRight
} from '@fortawesome/free-solid-svg-icons';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

interface MenuItem {
  path: string;
  icon: any;
  label: string;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const { t } = useTranslation();
  const location = useLocation();

  const menuItems: MenuItem[] = [
    { path: '/dashboard', icon: faChartLine, label: t('navigation.dashboard') },
    { path: '/upload', icon: faUpload, label: t('navigation.import') },
    { path: '/edition', icon: faEdit, label: t('navigation.edition') },
    { path: '/finance-global', icon: faChartBar, label: t('navigation.financeGlobal') },
    { path: '/parametre', icon: faCog, label: t('navigation.settings') },
  ];

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen bg-white dark:bg-gray-800 shadow-lg
        transition-all duration-300 ease-in-out z-40
        ${isCollapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
        {!isCollapsed && (
          <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400">
            Comptal2
          </h1>
        )}
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={isCollapsed ? t('navigation.expand') : t('navigation.collapse')}
        >
          <FontAwesomeIcon icon={isCollapsed ? faChevronRight : faChevronLeft} size="lg" />
        </button>
      </div>

      {/* Menu Items */}
      <nav className="p-2 space-y-1">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex items-center gap-3 px-3 py-3 rounded-lg
                transition-all duration-200
                ${isActive 
                  ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
                ${isCollapsed ? 'justify-center' : ''}
              `}
              title={isCollapsed ? item.label : ''}
            >
              <FontAwesomeIcon 
                icon={item.icon} 
                className={isActive ? 'text-primary-600 dark:text-primary-400' : ''}
                size="lg"
              />
              {!isCollapsed && (
                <span className="font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Version 1.0.0
          </p>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;

