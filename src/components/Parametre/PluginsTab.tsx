import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Puzzle, Upload, Trash2, Power, PowerOff } from 'lucide-react';
import { InstalledPlugin } from '../../types/plugin';
import { PluginService } from '../../services/PluginService';
import { Logger } from '../../services/logger';
import ConfirmModal from '../Common/ConfirmModal';

const PluginsTab: React.FC = () => {
  const { t } = useTranslation();
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setPlugins(await PluginService.listInstalled());
    } catch (err) {
      Logger.error('PluginsTab.reload', err);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleImport = async () => {
    setBusy(true);
    try {
      const manifest = await PluginService.importZip();
      if (!manifest) return;
      toast.success(t('settings.plugins.imported', { name: manifest.name }));
      await reload();
    } catch (err) {
      Logger.error('PluginsTab.import', err);
      toast.error(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (plugin: InstalledPlugin) => {
    setBusy(true);
    try {
      await PluginService.setEnabled(plugin.manifest.id, !plugin.enabled);
      toast.success(plugin.enabled ? t('settings.plugins.disabled') : t('settings.plugins.enabled'));
      await reload();
    } catch (err) {
      Logger.error('PluginsTab.toggle', err);
      toast.error(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setBusy(true);
    try {
      await PluginService.remove(deleteId);
      setDeleteId(null);
      toast.success(t('settings.plugins.deleted'));
      await reload();
    } catch (err) {
      Logger.error('PluginsTab.delete', err);
      toast.error(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="ct-card">
        <h3 className="ct-section-title flex items-center gap-2">
          <Puzzle size={20} /> {t('settings.plugins.title')}
        </h3>
        <p className="ct-hint">{t('settings.plugins.hint')}</p>
        <p className="ct-hint">{t('settings.plugins.security')}</p>
        <div className="mt-3">
          <button className="ct-btn-primary" disabled={busy} onClick={() => void handleImport()}>
            <Upload size={16} /> {t('settings.plugins.import')}
          </button>
        </div>
      </section>

      <section className="ct-card">
        {plugins.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--invoicing-gray-500)' }}>
            {t('settings.plugins.empty')}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {plugins.map((plugin) => (
              <div
                key={plugin.manifest.id}
                className="flex items-center gap-3 flex-wrap py-2 border-b"
                style={{ borderColor: 'var(--invoicing-gray-200)' }}
              >
                <div className="flex-1 min-w-[200px]">
                  <div className="font-medium">{plugin.manifest.name}</div>
                  <div className="text-xs" style={{ color: 'var(--invoicing-gray-500)' }}>
                    {plugin.manifest.id} · v{plugin.manifest.version} · {t(`settings.plugins.types.${plugin.manifest.type}`)}
                  </div>
                </div>
                <button
                  type="button"
                  className="ct-btn-secondary"
                  disabled={busy}
                  onClick={() => void handleToggle(plugin)}
                >
                  {plugin.enabled ? <PowerOff size={14} /> : <Power size={14} />}
                  {plugin.enabled ? t('settings.plugins.disable') : t('settings.plugins.enable')}
                </button>
                <button
                  type="button"
                  className="ct-btn-icon hover:!text-red-500"
                  title={t('common.delete')}
                  onClick={() => setDeleteId(plugin.manifest.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmModal
        isOpen={Boolean(deleteId)}
        title={t('settings.plugins.deleteTitle')}
        message={t('settings.plugins.deleteMessage')}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
};

export default PluginsTab;
