import { PDFTemplate } from '../types/invoice';
import { newEntityId, parseDateOrNow } from '../utils/invoiceFormat';
import { Db } from './db';
import { withLog } from './logger';

export const DEFAULT_PDF_TEMPLATES: PDFTemplate[] = [
  {
    id: 'template-classique',
    name: 'Classique',
    description: 'Layout traditionnel, typographie sobre',
    format: 'A4',
    orientation: 'portrait',
    typography: {
      headerFont: 'Helvetica',
      bodyFont: 'Helvetica',
      fontSize: { title: 18, header: 14, body: 10, footer: 8 },
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
    description: 'Design épuré, couleurs vives',
    format: 'A4',
    orientation: 'portrait',
    typography: {
      headerFont: 'Helvetica',
      bodyFont: 'Helvetica',
      fontSize: { title: 20, header: 14, body: 10, footer: 8 },
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
    description: 'Mise en page aérée, style monochrome',
    format: 'A4',
    orientation: 'portrait',
    typography: {
      headerFont: 'Helvetica',
      bodyFont: 'Helvetica',
      fontSize: { title: 16, header: 12, body: 9, footer: 7 },
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

function revive(raw: Partial<PDFTemplate>): PDFTemplate {
  return {
    ...(raw as PDFTemplate),
    createdAt: raw.createdAt ? parseDateOrNow(raw.createdAt) : undefined,
    updatedAt: raw.updatedAt ? parseDateOrNow(raw.updatedAt) : undefined,
  };
}

export const PDFTemplateService = {
  getDefaultTemplates(): PDFTemplate[] {
    return DEFAULT_PDF_TEMPLATES.map((t) => ({ ...t }));
  },

  async loadTemplates(): Promise<PDFTemplate[]> {
    return withLog('PDFTemplateService.loadTemplates', async () => {
      const rows = await Db.select<{ payload: string }>('SELECT payload FROM pdf_templates');
      if (rows.length === 0) {
        await this.saveTemplates(this.getDefaultTemplates());
        return this.getDefaultTemplates();
      }
      return rows.map((r) => revive(JSON.parse(r.payload)));
    });
  },

  async saveTemplates(templates: PDFTemplate[]): Promise<void> {
    return withLog('PDFTemplateService.saveTemplates', async () => {
      await Db.execute('DELETE FROM pdf_templates');
      for (const t of templates) {
        await Db.execute('INSERT INTO pdf_templates (id, payload) VALUES (?, ?)', [
          t.id,
          JSON.stringify({
            ...t,
            createdAt: t.createdAt?.toISOString(),
            updatedAt: t.updatedAt?.toISOString(),
          }),
        ]);
      }
    });
  },

  async getTemplateById(id: string): Promise<PDFTemplate | null> {
    const templates = await this.loadTemplates();
    return templates.find((t) => t.id === id) || null;
  },

  async saveCustomTemplate(template: PDFTemplate): Promise<void> {
    const templates = await this.loadTemplates();
    const updated: PDFTemplate = {
      ...template,
      id: template.id || newEntityId('template'),
      isDefault: false,
      createdAt: template.createdAt || new Date(),
      updatedAt: new Date(),
    };
    const index = templates.findIndex((t) => t.id === updated.id);
    if (index >= 0) templates[index] = updated;
    else templates.push(updated);
    await this.saveTemplates(templates);
  },

  async deleteTemplate(id: string): Promise<boolean> {
    if (DEFAULT_PDF_TEMPLATES.some((t) => t.id === id)) return false;
    const templates = (await this.loadTemplates()).filter((t) => t.id !== id);
    await this.saveTemplates(templates);
    return true;
  },

  async importList(raw: unknown[]): Promise<void> {
    if (!Array.isArray(raw) || raw.length === 0) return;
    await this.saveTemplates(raw.map((t) => revive(t as Partial<PDFTemplate>)));
  },
};
