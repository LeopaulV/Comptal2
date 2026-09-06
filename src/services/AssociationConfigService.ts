import { AssociationConfig } from '../types/association';
import { EMPTY_ADRESSE } from '../types/invoice';
import { parseDateOrNow, reviveAdresse } from '../utils/invoiceFormat';
import { loadSingletonJson, saveSingletonJson } from './jsonStore';
import { withLog } from './logger';

export function defaultAssociationConfig(): AssociationConfig {
  const now = new Date();
  return {
    denominationSociale: '',
    objetSocial: '',
    adresse: { ...EMPTY_ADRESSE },
    statutOIG: false,
    referencesCGI: 'Articles 200 et 238 bis du code général des impôts',
    nextReceiptNumber: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function revive(raw: Partial<AssociationConfig>): AssociationConfig {
  const base = defaultAssociationConfig();
  return {
    ...base,
    ...raw,
    adresse: reviveAdresse(raw.adresse ?? base.adresse),
    createdAt: parseDateOrNow(raw.createdAt),
    updatedAt: parseDateOrNow(raw.updatedAt),
  };
}

export const AssociationConfigService = {
  async loadConfig(): Promise<AssociationConfig | null> {
    return withLog('AssociationConfigService.loadConfig', async () => {
      const raw = await loadSingletonJson<Partial<AssociationConfig>>('association_config');
      if (!raw) return null;
      return revive(raw);
    });
  },

  async saveConfig(config: AssociationConfig): Promise<void> {
    return withLog('AssociationConfigService.saveConfig', async () => {
      const now = new Date();
      await saveSingletonJson('association_config', {
        ...config,
        createdAt: (config.createdAt || now).toISOString(),
        updatedAt: now.toISOString(),
      });
    });
  },

  async getOrCreateConfig(): Promise<AssociationConfig> {
    const loaded = await this.loadConfig();
    if (loaded) return loaded;
    const config = defaultAssociationConfig();
    await this.saveConfig(config);
    return config;
  },

  async importRaw(raw: unknown): Promise<void> {
    if (!raw || typeof raw !== 'object') return;
    await saveSingletonJson('association_config', raw);
  },
};
