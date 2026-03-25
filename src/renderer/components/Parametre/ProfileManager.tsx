import React, { useState, useEffect } from 'react';
import { UserPlus, FolderOpen, Trash2, Check, Download, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Card } from '../Common';
import { ProfileService, ProfileListItem } from '../../services/ProfileService';

const ProfileManager: React.FC = () => {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<ProfileListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importZipPath, setImportZipPath] = useState<string | null>(null);
  const [importProfileName, setImportProfileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [deleteConfirmProfileId, setDeleteConfirmProfileId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = async () => {
    setLoading(true);
    setError(null);
    try {
      await ProfileService.ensureInitialized();
      const list = await ProfileService.listProfiles();
      setProfiles(list);
    } catch (err: any) {
      setError(err.message || t('profiles.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error(t('profiles.nameRequired'));
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await ProfileService.createProfile(name, newDescription.trim() || undefined);
      setShowCreateModal(false);
      setNewName('');
      setNewDescription('');
      toast.success(t('profiles.createSuccess', 'Profil créé'));
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || t('profiles.createError'));
    } finally {
      setCreating(false);
    }
  };

  const handleSwitch = async (profileId: string) => {
    setSwitching(profileId);
    setError(null);
    try {
      await ProfileService.switchProfile(profileId);
      toast.success(t('profiles.switchSuccess', 'Profil chargé'));
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || t('profiles.switchError'));
    } finally {
      setSwitching(null);
    }
  };

  const handleDeleteClick = (profileId: string) => {
    setDeleteConfirmProfileId(profileId);
  };

  const handleExport = async (profile: ProfileListItem) => {
    setExporting(profile.id);
    try {
      if (profile.isActive) {
        await ProfileService.saveCurrentProfileToStorage(profile.id);
      }
      const result = await ProfileService.exportProfile(profile.id, profile.name);
      if (result.canceled) return;
      toast.success(t('profiles.exportSuccess', { path: result.path }));
    } catch (err: any) {
      toast.error(err.message || t('profiles.exportError'));
    } finally {
      setExporting(null);
    }
  };

  const handleImportClick = async () => {
    const result = await window.electronAPI.selectFile({
      filters: [{ name: 'Archive ZIP', extensions: ['zip'] }, { name: 'Tous les fichiers', extensions: ['*'] }],
    });
    if (result.success && result.path) {
      setImportZipPath(result.path);
      setImportProfileName('');
      setShowImportModal(true);
    }
  };

  const handleImportConfirm = async () => {
    if (!importZipPath) return;
    const name = importProfileName.trim() || t('profiles.importedDefault', 'Profil importé');
    setImporting(true);
    try {
      await ProfileService.importProfile(importZipPath, name);
      setShowImportModal(false);
      setImportZipPath(null);
      setImportProfileName('');
      toast.success(t('profiles.importSuccess'));
      await loadProfiles();
    } catch (err: any) {
      toast.error(err.message || t('profiles.importError'));
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    const profileId = deleteConfirmProfileId;
    if (!profileId) return;
    setDeleteConfirmProfileId(null);
    setDeleting(profileId);
    setError(null);
    try {
      await ProfileService.deleteProfile(profileId);
      toast.success(t('profiles.deleteSuccess', 'Profil supprimé'));
      await loadProfiles();
    } catch (err: any) {
      toast.error(err.message || t('profiles.deleteError'));
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <Card title={t('profiles.title')} subtitle={t('profiles.subtitle')}>
      <div className="space-y-6">
        {error && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleImportClick}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200
                       bg-[var(--invoicing-gray-200)] dark:bg-[var(--invoicing-gray-300)]
                       text-[var(--invoicing-gray-900)] dark:text-[var(--invoicing-gray-800)]
                       hover:bg-[var(--invoicing-gray-300)] dark:hover:bg-[var(--invoicing-gray-400)]
                       hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
          >
            <Upload size={18} />
            {t('profiles.importProfile')}
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-all duration-200
                       bg-[var(--invoicing-primary)] hover:bg-[var(--invoicing-primary-light)] 
                       hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
          >
            <UserPlus size={18} />
            {t('profiles.newProfile')}
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[var(--invoicing-gray-500)]">
            {t('profiles.loading')}
          </div>
        ) : profiles.length === 0 ? (
          <div className="py-12 text-center text-[var(--invoicing-gray-500)]">
            {t('profiles.empty')}
          </div>
        ) : (
          <ul className="space-y-3">
            {profiles.map((profile) => (
              <li
                key={profile.id}
                className="flex items-center justify-between gap-4 p-4 rounded-xl border border-[var(--invoicing-gray-200)] 
                         bg-[var(--invoicing-gray-50)] dark:bg-[var(--invoicing-gray-100)] 
                         dark:border-[var(--invoicing-gray-300)] transition-all duration-200 
                         hover:shadow-[var(--shadow-sm)]"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--invoicing-gray-900)] dark:text-[var(--invoicing-gray-800)] truncate">
                      {profile.name}
                    </span>
                    {profile.isActive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                                    bg-[var(--invoicing-primary)] text-white">
                        <Check size={12} />
                        {t('profiles.active')}
                      </span>
                    )}
                  </div>
                  {profile.description && (
                    <p className="text-sm text-[var(--invoicing-gray-500)] mt-0.5 truncate">
                      {profile.description}
                    </p>
                  )}
                  <p className="text-xs text-[var(--invoicing-gray-400)] mt-1">
                    {t('profiles.lastSaved')}: {formatDate(profile.lastSaved || profile.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleExport(profile)}
                    disabled={!!exporting}
                    className="p-2 rounded-lg text-[var(--invoicing-gray-600)] dark:text-[var(--invoicing-gray-500)]
                             hover:bg-[var(--invoicing-gray-200)] dark:hover:bg-[var(--invoicing-gray-300)] transition-colors
                             disabled:opacity-50 disabled:cursor-not-allowed"
                    title={t('profiles.export')}
                  >
                    <Download size={18} />
                  </button>
                  {!profile.isActive && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSwitch(profile.id)}
                        disabled={!!switching}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all duration-200
                                 bg-[var(--invoicing-gray-200)] dark:bg-[var(--invoicing-gray-300)] 
                                 text-[var(--invoicing-gray-900)] dark:text-[var(--invoicing-gray-800)]
                                 hover:bg-[var(--invoicing-primary)] hover:text-white 
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FolderOpen size={16} />
                        {switching === profile.id ? t('profiles.switching') : t('profiles.load')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(profile.id)}
                        disabled={!!deleting}
                        className="p-2 rounded-lg text-[var(--invoicing-danger)] 
                                 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={t('profiles.delete')}
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {deleteConfirmProfileId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          <div
            className="w-full max-w-md mx-4 p-6 rounded-2xl border border-[var(--invoicing-gray-200)]
                     bg-white dark:bg-[var(--invoicing-gray-50)] dark:border-[var(--invoicing-gray-300)]
                     shadow-[var(--shadow-xl)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-confirm-title" className="text-xl font-semibold text-[var(--invoicing-gray-900)] dark:text-[var(--invoicing-gray-800)] mb-4">
              {t('profiles.deleteConfirmTitle', 'Supprimer ce profil ?')}
            </h3>
            <p className="text-[var(--invoicing-gray-600)] dark:text-[var(--invoicing-gray-500)] mb-6">
              {t('profiles.deleteConfirm')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmProfileId(null)}
                className="px-4 py-2 rounded-lg font-medium bg-[var(--invoicing-gray-200)]
                         dark:bg-[var(--invoicing-gray-300)] text-[var(--invoicing-gray-900)]
                         dark:text-[var(--invoicing-gray-800)] hover:bg-[var(--invoicing-gray-300)]
                         dark:hover:bg-[var(--invoicing-gray-400)] transition-colors"
              >
                {t('profiles.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={!!deleting}
                className="px-4 py-2 rounded-lg font-medium text-white
                         bg-[var(--invoicing-danger)] hover:opacity-90 transition-colors disabled:opacity-50"
              >
                {deleting ? t('profiles.deleting', 'Suppression...') : t('profiles.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && importZipPath && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-profile-title"
        >
          <div
            className="w-full max-w-md mx-4 p-6 rounded-2xl border border-[var(--invoicing-gray-200)]
                     bg-white dark:bg-[var(--invoicing-gray-50)] dark:border-[var(--invoicing-gray-300)]
                     shadow-[var(--shadow-xl)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="import-profile-title" className="text-xl font-semibold text-[var(--invoicing-gray-900)] dark:text-[var(--invoicing-gray-800)] mb-4">
              {t('profiles.importTitle')}
            </h3>
            <p className="text-sm text-[var(--invoicing-gray-500)] mb-4 truncate" title={importZipPath}>
              {importZipPath.split(/[/\\]/).pop()}
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--invoicing-gray-700)] dark:text-[var(--invoicing-gray-600)] mb-2">
                {t('profiles.name')} *
              </label>
              <input
                type="text"
                value={importProfileName}
                onChange={(e) => setImportProfileName(e.target.value)}
                placeholder={t('profiles.importNamePlaceholder')}
                className="w-full px-3 py-2 rounded-lg border border-[var(--invoicing-gray-300)]
                         dark:border-[var(--invoicing-gray-400)] bg-white dark:bg-[var(--invoicing-gray-100)]
                         text-[var(--invoicing-gray-900)] dark:text-[var(--invoicing-gray-800)]
                         focus:ring-2 focus:ring-[var(--invoicing-primary)] focus:border-transparent"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportZipPath(null);
                  setImportProfileName('');
                }}
                disabled={importing}
                className="px-4 py-2 rounded-lg font-medium bg-[var(--invoicing-gray-200)]
                         dark:bg-[var(--invoicing-gray-300)] text-[var(--invoicing-gray-900)]
                         dark:text-[var(--invoicing-gray-800)] hover:bg-[var(--invoicing-gray-300)]
                         dark:hover:bg-[var(--invoicing-gray-400)] transition-colors disabled:opacity-50"
              >
                {t('profiles.cancel')}
              </button>
              <button
                type="button"
                onClick={handleImportConfirm}
                disabled={importing}
                className="px-4 py-2 rounded-lg font-medium text-white
                         bg-[var(--invoicing-primary)] hover:bg-[var(--invoicing-primary-light)]
                         transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0"
              >
                {importing ? t('profiles.importing') : t('profiles.import')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-profile-title"
        >
          <div
            className="w-full max-w-md mx-4 p-6 rounded-2xl border border-[var(--invoicing-gray-200)] 
                     bg-white dark:bg-[var(--invoicing-gray-50)] dark:border-[var(--invoicing-gray-300)]
                     shadow-[var(--shadow-xl)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="create-profile-title" className="text-xl font-semibold text-[var(--invoicing-gray-900)] dark:text-[var(--invoicing-gray-800)] mb-4">
              {t('profiles.createTitle')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--invoicing-gray-700)] dark:text-[var(--invoicing-gray-600)] mb-2">
                  {t('profiles.name')} *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('profiles.namePlaceholder')}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--invoicing-gray-300)] 
                           dark:border-[var(--invoicing-gray-400)] bg-white dark:bg-[var(--invoicing-gray-100)]
                           text-[var(--invoicing-gray-900)] dark:text-[var(--invoicing-gray-800)]
                           focus:ring-2 focus:ring-[var(--invoicing-primary)] focus:border-transparent"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--invoicing-gray-700)] dark:text-[var(--invoicing-gray-600)] mb-2">
                  {t('profiles.description')}
                </label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder={t('profiles.descriptionPlaceholder')}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--invoicing-gray-300)] 
                           dark:border-[var(--invoicing-gray-400)] bg-white dark:bg-[var(--invoicing-gray-100)]
                           text-[var(--invoicing-gray-900)] dark:text-[var(--invoicing-gray-800)]
                           focus:ring-2 focus:ring-[var(--invoicing-primary)] focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewName('');
                  setNewDescription('');
                  setError(null);
                }}
                disabled={creating}
                className="px-4 py-2 rounded-lg font-medium bg-[var(--invoicing-gray-200)] 
                         dark:bg-[var(--invoicing-gray-300)] text-[var(--invoicing-gray-900)] 
                         dark:text-[var(--invoicing-gray-800)] hover:bg-[var(--invoicing-gray-300)] 
                         dark:hover:bg-[var(--invoicing-gray-400)] transition-colors disabled:opacity-50"
              >
                {t('profiles.cancel')}
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="px-4 py-2 rounded-lg font-medium text-white 
                         bg-[var(--invoicing-primary)] hover:bg-[var(--invoicing-primary-light)] 
                         transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0"
              >
                {creating ? t('profiles.creating') : t('profiles.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default ProfileManager;
