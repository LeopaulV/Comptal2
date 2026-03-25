import { PDFTemplate, PDFTemplateSerialized } from '../types/Invoice';
import { FileService } from './FileService';
import { ProfilePaths } from './ProfilePaths';

// Templates par défaut
const DEFAULT_TEMPLATES: PDFTemplate[] = [
  {
    id: 'template-classique',
    name: 'Classique',
    description: 'Layout traditionnel avec logo en haut à gauche, typographie sobre et couleurs neutres',
    format: 'A4',
    orientation: 'portrait',
    typography: {
      headerFont: 'Helvetica',
      bodyFont: 'Helvetica',
      fontSize: {
        title: 18,
        header: 14,
        body: 10,
        footer: 8,
      },
    },
    colors: {
      primary: '#1e3a8a',
      secondary: '#475569',
      accent: '#3b82f6',
      text: '#1f2937',
      border: '#e5e7eb',
    },
    layout: {
      margins: { top: 40, right: 40, bottom: 40, left: 40 },
      headerHeight: 80,
      footerHeight: 40,
      logoPosition: 'left',
      logoSize: { width: 120, height: 60 },
    },
    isDefault: true,
  },
  {
    id: 'template-moderne',
    name: 'Moderne',
    description: 'Design épuré avec logo centré, typographie contemporaine et couleurs vives',
    format: 'A4',
    orientation: 'portrait',
    typography: {
      headerFont: 'Roboto',
      bodyFont: 'Roboto',
      fontSize: {
        title: 20,
        header: 14,
        body: 10,
        footer: 8,
      },
    },
    colors: {
      primary: '#6366f1',
      secondary: '#8b5cf6',
      accent: '#ec4899',
      text: '#111827',
      border: '#c7d2fe',
    },
    layout: {
      margins: { top: 30, right: 30, bottom: 30, left: 30 },
      headerHeight: 100,
      footerHeight: 50,
      logoPosition: 'center',
      logoSize: { width: 150, height: 75 },
    },
    isDefault: false,
  },
  {
    id: 'template-minimaliste',
    name: 'Minimaliste',
    description: 'Mise en page aérée, logo discret, typographie fine et style monochrome',
    format: 'A4',
    orientation: 'portrait',
    typography: {
      headerFont: 'Helvetica',
      bodyFont: 'Helvetica',
      fontSize: {
        title: 16,
        header: 12,
        body: 9,
        footer: 7,
      },
    },
    colors: {
      primary: '#374151',
      secondary: '#6b7280',
      accent: '#9ca3af',
      text: '#1f2937',
      border: '#f3f4f6',
    },
    layout: {
      margins: { top: 50, right: 50, bottom: 50, left: 50 },
      headerHeight: 60,
      footerHeight: 30,
      logoPosition: 'right',
      logoSize: { width: 80, height: 40 },
    },
    isDefault: false,
  },
];

export class PDFTemplateService {
  private static templatesCache: PDFTemplate[] | null = null;

  /**
   * Retourne les templates par défaut
   */
  static getDefaultTemplates(): PDFTemplate[] {
    return [...DEFAULT_TEMPLATES];
  }

  /**
   * Charge tous les templates (par défaut + personnalisés)
   */
  static async loadTemplates(): Promise<PDFTemplate[]> {
    if (this.templatesCache) {
      return this.templatesCache;
    }

    try {
      const content = await FileService.readFile(await ProfilePaths.parametreFile('pdf_templates.json'));
      const parsed: PDFTemplateSerialized[] = JSON.parse(content);
      
      const templates: PDFTemplate[] = parsed.map((t) => ({
        ...t,
        createdAt: t.createdAt ? new Date(t.createdAt) : undefined,
        updatedAt: t.updatedAt ? new Date(t.updatedAt) : undefined,
      }));
      
      this.templatesCache = templates;
      return templates;
    } catch (error) {
      // Si le fichier n'existe pas, retourner les templates par défaut
      console.log('[PDFTemplateService] Fichier non trouvé, utilisation des templates par défaut');
      this.templatesCache = this.getDefaultTemplates();
      return this.templatesCache;
    }
  }

  /**
   * Sauvegarde tous les templates
   */
  static async saveTemplates(templates: PDFTemplate[]): Promise<void> {
    const serialized: PDFTemplateSerialized[] = templates.map((t) => ({
      ...t,
      createdAt: t.createdAt?.toISOString(),
      updatedAt: t.updatedAt?.toISOString(),
    }));

    const content = JSON.stringify(serialized, null, 2);
    await FileService.writeFile(await ProfilePaths.parametreFile('pdf_templates.json'), content);
    this.templatesCache = templates;
  }

  /**
   * Récupère un template par son ID
   */
  static async getTemplateById(id: string): Promise<PDFTemplate | null> {
    const templates = await this.loadTemplates();
    return templates.find((t) => t.id === id) || null;
  }

  /**
   * Sauvegarde ou met à jour un template personnalisé
   */
  static async saveCustomTemplate(template: PDFTemplate): Promise<void> {
    const templates = await this.loadTemplates();
    const index = templates.findIndex((t) => t.id === template.id);
    
    const updatedTemplate: PDFTemplate = {
      ...template,
      updatedAt: new Date(),
      createdAt: template.createdAt || new Date(),
    };

    if (index >= 0) {
      templates[index] = updatedTemplate;
    } else {
      templates.push(updatedTemplate);
    }

    await this.saveTemplates(templates);
  }

  /**
   * Supprime un template personnalisé (les templates par défaut ne peuvent pas être supprimés)
   */
  static async deleteTemplate(id: string): Promise<boolean> {
    const defaultIds = DEFAULT_TEMPLATES.map((t) => t.id);
    if (defaultIds.includes(id)) {
      console.warn('[PDFTemplateService] Impossible de supprimer un template par défaut');
      return false;
    }

    const templates = await this.loadTemplates();
    const filtered = templates.filter((t) => t.id !== id);
    
    if (filtered.length === templates.length) {
      return false;
    }

    await this.saveTemplates(filtered);
    return true;
  }

  /**
   * Réinitialise les templates aux valeurs par défaut
   */
  static async resetToDefaults(): Promise<void> {
    const defaults = this.getDefaultTemplates();
    await this.saveTemplates(defaults);
  }

  /**
   * Duplique un template existant
   */
  static async duplicateTemplate(id: string, newName: string): Promise<PDFTemplate | null> {
    const original = await this.getTemplateById(id);
    if (!original) {
      return null;
    }

    const newTemplate: PDFTemplate = {
      ...original,
      id: `template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: newName,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.saveCustomTemplate(newTemplate);
    return newTemplate;
  }

  /**
   * Invalide le cache
   */
  static clearCache(): void {
    this.templatesCache = null;
  }
}
