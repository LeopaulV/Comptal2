import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Logger } from '../../services/logger';
import { isTauriAvailable } from '../../services/tauri';
import { UpdateProgress, UpdateService } from '../../services/UpdateService';

/** Vérifie au démarrage (build production) et installe la dernière GitHub Release. */
const UpdateNotifier: React.FC = () => {
  const { t } = useTranslation();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!isTauriAvailable() || Logger.session?.dev) return;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const update = await UpdateService.checkForUpdate();
          if (!update) return;

          const toastId = toast.info(
            t('settings.about.autoUpdateStart', { version: update.version }),
            { autoClose: false }
          );

          await UpdateService.downloadInstallAndRelaunch(update, (p: UpdateProgress) => {
            if (!p.total || p.total <= 0) return;
            const percent = Math.min(100, Math.round((p.downloaded / p.total) * 100));
            toast.update(toastId, {
              render: t('settings.about.autoUpdating', { version: update.version, percent }),
            });
          });
        } catch (err) {
          Logger.warn('UpdateNotifier', err instanceof Error ? err.message : String(err));
        }
      })();
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [t]);

  return null;
};

export default UpdateNotifier;
