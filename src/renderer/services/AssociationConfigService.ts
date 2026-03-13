import { AssociationConfig, AssociationConfigSerialized } from '../types/Association';
import { FileService } from './FileService';

const ASSOCIATION_CONFIG_PATH = 'parametre/association_config.json';

const defaultConfig = (): AssociationConfig => ({
  denominationSociale: '',
  objetSocial: '',
  adresse: { rue: '', codePostal: '', ville: '', pays: 'France' },
  statutOIG: false,
  referencesCGI: 'Articles 200 et 238 bis du code général des impôts',
  createdAt: new Date(),
  updatedAt: new Date(),
});

export class AssociationConfigService {
  static async loadConfig(): Promise<AssociationConfig | null> {
    try {
      const content = await FileService.readFile(ASSOCIATION_CONFIG_PATH);
      const parsed = JSON.parse(content) as Partial<AssociationConfigSerialized>;

      const base = defaultConfig();

      return {
        ...base,
        ...parsed,
        adresse: parsed.adresse ?? base.adresse,
        createdAt: parsed.createdAt ? new Date(parsed.createdAt) : base.createdAt,
        updatedAt: parsed.updatedAt ? new Date(parsed.updatedAt) : base.updatedAt,
      };
    } catch {
      return null;
    }
  }

  static async saveConfig(config: AssociationConfig): Promise<void> {
    const serialized: AssociationConfigSerialized = {
      ...config,
      createdAt: config.createdAt.toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const content = JSON.stringify(serialized, null, 2);
    await FileService.writeFile(ASSOCIATION_CONFIG_PATH, content);
  }

  static async getOrCreateConfig(): Promise<AssociationConfig> {
    const loaded = await this.loadConfig();
    if (loaded) return loaded;
    const config = defaultConfig();
    await this.saveConfig(config);
    return config;
  }
}
