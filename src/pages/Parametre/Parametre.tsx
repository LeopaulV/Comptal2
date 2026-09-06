import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Settings2, Users, Landmark, Tags, Database, Building2, Info, Puzzle } from 'lucide-react';
import GeneralTab from '../../components/Parametre/GeneralTab';
import ProfilesTab from '../../components/Parametre/ProfilesTab';
import AccountsTab from '../../components/Parametre/AccountsTab';
import CategoriesTab from '../../components/Parametre/CategoriesTab';
import DataTab from '../../components/Parametre/DataTab';
import AboutTab from '../../components/Parametre/AboutTab';
import OrganizationTab from '../../components/Parametre/OrganizationTab';
import PluginsTab from '../../components/Parametre/PluginsTab';

type TabId = 'general' | 'profiles' | 'accounts' | 'categories' | 'data' | 'organization' | 'plugins' | 'about';

const TAB_IDS: TabId[] = [
  'general',
  'profiles',
  'accounts',
  'categories',
  'data',
  'organization',
  'plugins',
  'about',
];

const TABS: Array<{ id: TabId; icon: React.ReactNode; labelKey: string }> = [
  { id: 'general', icon: <Settings2 size={16} />, labelKey: 'settings.tabs.general' },
  { id: 'profiles', icon: <Users size={16} />, labelKey: 'settings.tabs.profiles' },
  { id: 'accounts', icon: <Landmark size={16} />, labelKey: 'settings.tabs.accounts' },
  { id: 'categories', icon: <Tags size={16} />, labelKey: 'settings.tabs.categories' },
  { id: 'data', icon: <Database size={16} />, labelKey: 'settings.tabs.data' },
  { id: 'organization', icon: <Building2 size={16} />, labelKey: 'settings.tabs.organization' },
  { id: 'plugins', icon: <Puzzle size={16} />, labelKey: 'settings.tabs.plugins' },
  { id: 'about', icon: <Info size={16} />, labelKey: 'settings.tabs.about' },
];

function isTabId(value: string | null): value is TabId {
  return value !== null && (TAB_IDS as string[]).includes(value);
}

const Parametre: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<TabId>(() =>
    isTabId(tabFromUrl) ? tabFromUrl : 'general'
  );
  // Incrémenté à chaque changement de profil pour forcer le re-montage des onglets liés aux données
  const [profileEpoch, setProfileEpoch] = useState(0);

  useEffect(() => {
    const next = searchParams.get('tab');
    if (isTabId(next) && next !== activeTab) {
      setActiveTab(next);
    }
  }, [activeTab, searchParams]);

  const selectTab = (id: TabId) => {
    setActiveTab(id);
    setSearchParams({ tab: id }, { replace: true });
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--invoicing-gray-900)' }}>
        {t('settings.title')}
      </h1>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => selectTab(tab.id)}
            className={`settings-tab flex items-center gap-2 transition-all${
              activeTab === tab.id ? ' is-active' : ''
            }`}
          >
            {tab.icon}
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <div className="pb-8">
        {activeTab === 'general' && <GeneralTab />}
        {activeTab === 'profiles' && (
          <ProfilesTab onProfileChanged={() => setProfileEpoch((e) => e + 1)} />
        )}
        {activeTab === 'accounts' && <AccountsTab key={`accounts-${profileEpoch}`} />}
        {activeTab === 'categories' && <CategoriesTab key={`categories-${profileEpoch}`} />}
        {activeTab === 'data' && <DataTab key={`data-${profileEpoch}`} />}
        {activeTab === 'organization' && <OrganizationTab key={`org-${profileEpoch}`} />}
        {activeTab === 'plugins' && <PluginsTab key={`plugins-${profileEpoch}`} />}
        {activeTab === 'about' && <AboutTab />}
      </div>
    </div>
  );
};

export default Parametre;
