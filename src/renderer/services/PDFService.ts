import pdfMake from 'pdfmake/build/pdfmake';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { Devis, Emetteur, EmetteurExtended, Facture, PosteFacture, PDFTemplate } from '../types/Invoice';
import { ClientService } from './ClientService';
import { PDFTemplateService } from './PDFTemplateService';
import { LegalMentionsService } from './LegalMentionsService';

// Initialisation des fonts pdfmake - import dynamique pour éviter les problèmes d'export
let fontsLoaded = false;

const setPdfMakeVfs = (vfs: unknown) => {
  try {
    Object.defineProperty(pdfMake, 'vfs', {
      value: vfs,
      writable: true,
      configurable: true,
    });
  } catch {
    (pdfMake as any).vfs = vfs;
  }
};

const loadFonts = async () => {
  if (fontsLoaded) return;
  try {
    const pdfFonts = await import('pdfmake/build/vfs_fonts');
    if (pdfFonts && (pdfFonts as any).default) {
      const fonts = (pdfFonts as any).default;
      if (fonts.pdfMake && fonts.pdfMake.vfs) {
        setPdfMakeVfs(fonts.pdfMake.vfs);
        fontsLoaded = true;
      } else if (fonts.vfs) {
        setPdfMakeVfs(fonts.vfs);
        fontsLoaded = true;
      }
    } else if ((pdfFonts as any).pdfMake && (pdfFonts as any).pdfMake.vfs) {
      setPdfMakeVfs((pdfFonts as any).pdfMake.vfs);
      fontsLoaded = true;
    }
  } catch (error) {
    console.warn('Impossible de charger les fonts pdfmake:', error);
  }
};

/** Charge les fonts pdfmake une seule fois (partagé avec PDFPreviewPanel et génération PDF). */
export const ensurePdfMakeFonts = loadFonts;

const formatCurrency = (value: number) => `${value.toFixed(2)} €`;

const buildPostesRows = (postes: PosteFacture[]) => {
  return postes.map((poste) => {
    const totalHT = poste.type === 'materiel'
      ? poste.prixUnitaireHT * poste.quantite
      : poste.tauxHoraire * poste.heuresEstimees * poste.nombreIntervenants;
    return [
      poste.designation,
      poste.type === 'materiel' ? poste.quantite : poste.heuresEstimees,
      formatCurrency(poste.type === 'materiel' ? poste.prixUnitaireHT : poste.tauxHoraire),
      `${poste.tauxTVA}%`,
      formatCurrency(totalHT),
    ];
  });
};

const buildHeaderContent = (emetteur: Emetteur, template?: PDFTemplate) => {
  const colors = template?.colors || {
    primary: '#1e3a8a',
    secondary: '#475569',
    text: '#1f2937',
  };

  const textStack = [
    { text: emetteur.denominationSociale, style: 'header', color: colors.primary },
    { text: `${emetteur.adresse.rue}, ${emetteur.adresse.codePostal} ${emetteur.adresse.ville}`, color: colors.secondary },
    { text: `SIRET: ${emetteur.siret}`, color: colors.secondary },
    { text: `TVA: ${emetteur.numeroTVA || 'Non assujetti'}`, color: colors.secondary },
  ];

  if (emetteur.logo) {
    const logoWidth = template?.layout?.logoSize?.width || 120;
    const logoPosition = template?.layout?.logoPosition || 'left';

    if (logoPosition === 'center') {
      return [
        { image: emetteur.logo, width: logoWidth, alignment: 'center', margin: [0, 0, 0, 10] },
        { stack: textStack, alignment: 'center' },
        { text: '\n' },
      ];
    } else if (logoPosition === 'right') {
      return [
        {
          columns: [
            { stack: textStack, alignment: 'left' },
            { image: emetteur.logo, width: logoWidth, alignment: 'right' },
          ],
          columnGap: 20,
        },
        { text: '\n' },
      ];
    } else {
      return [
        {
          columns: [
            { image: emetteur.logo, width: logoWidth },
            { stack: textStack, alignment: 'right' },
          ],
          columnGap: 12,
        },
        { text: '\n' },
      ];
    }
  }

  return [...textStack, { text: '\n' }];
};

const buildStyledDocDefinition = (
  content: any[],
  template?: PDFTemplate
): Partial<TDocumentDefinitions> => {
  const colors = template?.colors || {
    primary: '#1e3a8a',
    secondary: '#475569',
    text: '#1f2937',
    border: '#e5e7eb',
  };

  const fontSize = template?.typography?.fontSize || {
    title: 18,
    header: 14,
    body: 10,
    footer: 8,
  };

  // Convertir le format en majuscules pour pdfmake (LETTER au lieu de Letter)
  const pageSize = template?.format === 'Letter' ? 'LETTER' : (template?.format || 'A4');
  
  return {
    pageSize,
    pageOrientation: template?.orientation || 'portrait',
    pageMargins: template?.layout?.margins
      ? [
          template.layout.margins.left,
          template.layout.margins.top,
          template.layout.margins.right,
          template.layout.margins.bottom,
        ]
      : [40, 40, 40, 40],
    content,
    styles: {
      header: { fontSize: fontSize.title, bold: true, color: colors.primary },
      title: { fontSize: fontSize.header + 2, bold: true, margin: [0, 10, 0, 10], color: colors.primary },
      subheader: { fontSize: fontSize.header, bold: true, margin: [0, 10, 0, 5], color: colors.primary },
      total: { fontSize: fontSize.header, bold: true, color: colors.primary },
      tableHeader: { fontSize: fontSize.body, bold: true },
      mentions: { fontSize: fontSize.footer, color: colors.secondary },
    },
    defaultStyle: {
      fontSize: fontSize.body,
      color: colors.text,
    },
  };
};

const buildTableLayout = (template?: PDFTemplate) => {
  const colors = template?.colors || { primary: '#1e3a8a', border: '#e5e7eb' };
  
  return {
    hLineWidth: () => 0.5,
    vLineWidth: () => 0.5,
    hLineColor: () => colors.border,
    vLineColor: () => colors.border,
    fillColor: (rowIndex: number) => (rowIndex === 0 ? colors.primary : null),
  };
};

const isElectronAvailable = () =>
  typeof window !== 'undefined'
  && typeof window.electronAPI?.saveFile === 'function'
  && typeof window.electronAPI?.writeBinaryFile === 'function';

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Format de base64 invalide'));
        return;
      }
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Impossible de convertir le PDF en base64'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Impossible de lire le PDF'));
    reader.readAsDataURL(blob);
  });

const getPdfBlob = (pdfDoc: ReturnType<typeof pdfMake.createPdf>): Promise<Blob> => {
  return new Promise((resolve) => {
    pdfDoc.getBlob((blob: Blob) => {
      resolve(blob);
    });
  });
};

const saveOrDownloadPdf = async (docDefinition: TDocumentDefinitions, defaultFileName: string) => {
  const pdfDoc = pdfMake.createPdf(docDefinition);
  if (isElectronAvailable()) {
    const blob = await getPdfBlob(pdfDoc);
    const base64 = await blobToBase64(blob);
    const result = await window.electronAPI.saveFile({
      defaultPath: defaultFileName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (!result.success || !result.path) {
      return;
    }
    const writeResult = await window.electronAPI.writeBinaryFile(result.path, base64);
    if (!writeResult.success) {
      throw new Error(writeResult.error || 'Erreur lors de la sauvegarde du PDF');
    }
    return;
  }
  pdfDoc.download(defaultFileName);
};

export class PDFService {
  /**
   * Charge le template à utiliser pour un document
   */
  private static async getTemplate(templateId?: string): Promise<PDFTemplate | undefined> {
    if (templateId) {
      const template = await PDFTemplateService.getTemplateById(templateId);
      if (template) return template;
    }
    // Retourner le template par défaut
    const templates = await PDFTemplateService.loadTemplates();
    return templates.find((t) => t.isDefault) || templates[0];
  }

  /**
   * Génère le texte des mentions légales (IDs + personnalisées + valeurs des placeholders)
   */
  private static async getMentionsText(
    mentionIds?: string[],
    customMentions?: import('../types/Invoice').MentionLegale[],
    placeholderValues?: import('../types/Invoice').MentionPlaceholderValues
  ): Promise<string> {
    if (!mentionIds || mentionIds.length === 0) return '';
    return await LegalMentionsService.generateMentionsText(
      mentionIds,
      customMentions ?? [],
      placeholderValues ?? {}
    );
  }

  static async generateDevisPDF(
    devis: Devis,
    emetteur: Emetteur | EmetteurExtended,
    options?: { templateId?: string; mentionIds?: string[] }
  ): Promise<void> {
    await loadFonts();
    const client = await ClientService.getClientById(devis.clientId);
    const clientName =
      client?.denominationSociale || `${client?.prenom || ''} ${client?.nom || ''}`.trim();

    const ext = emetteur as EmetteurExtended;
    const templateId = ext.pdfTemplateDevis ?? options?.templateId;
    const template = await this.getTemplate(templateId);
    const mentionIds = ext.selectedMentionsLegales ?? options?.mentionIds;
    const mentionsText = await this.getMentionsText(
      mentionIds,
      ext.customMentionsLegales,
      ext.mentionPlaceholderValues
    );
    const colors = template?.colors || { primary: '#1e3a8a', border: '#e5e7eb' };

    const content = [
      ...buildHeaderContent(emetteur, template),
      { text: `DEVIS N° ${devis.numero}`, style: 'title' },
      { text: `Date: ${devis.dateEmission.toLocaleDateString('fr-FR')}` },
      { text: `Validité: ${devis.dateValidite.toLocaleDateString('fr-FR')}` },
      { text: '\n' },
      { text: 'Client:', style: 'subheader' },
      { text: clientName || 'Client inconnu' },
      { text: '\n' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Désignation', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
              { text: 'Qté', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
              { text: 'Prix U. HT', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
              { text: 'TVA', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
              { text: 'Total HT', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
            ],
            ...buildPostesRows(devis.postes),
          ],
        },
        layout: buildTableLayout(template),
      },
      { text: '\n' },
      { text: `Total HT: ${formatCurrency(devis.totalHT)}`, alignment: 'right' },
      {
        text: `Total TVA: ${formatCurrency(
          Object.values(devis.totalTVA).reduce((a, b) => a + b, 0)
        )}`,
        alignment: 'right',
      },
      { text: `Total TTC: ${formatCurrency(devis.totalTTC)}`, style: 'total', alignment: 'right' },
      { text: '\n' },
      { text: devis.conditionsPaiement || '', style: 'mentions' },
      { text: mentionsText || devis.mentionsLegales || '', style: 'mentions' },
    ];

    const docDefinition: TDocumentDefinitions = {
      ...buildStyledDocDefinition(content, template),
      content,
    } as TDocumentDefinitions;

    await saveOrDownloadPdf(docDefinition, `${devis.numero}.pdf`);
  }

  /**
   * Génère le PDF d'un devis et le sauvegarde dans data/attachments (pour pièce jointe automatique).
   */
  static async generateDevisPDFToFile(
    devis: Devis,
    emetteur: Emetteur | EmetteurExtended,
    options?: { templateId?: string; mentionIds?: string[] }
  ): Promise<{ path: string; name: string }> {
    await loadFonts();
    const client = await ClientService.getClientById(devis.clientId);
    const clientName =
      client?.denominationSociale || `${client?.prenom || ''} ${client?.nom || ''}`.trim();

    const ext = emetteur as EmetteurExtended;
    const templateId = ext.pdfTemplateDevis ?? options?.templateId;
    const template = await this.getTemplate(templateId);
    const mentionIds = ext.selectedMentionsLegales ?? options?.mentionIds;
    const mentionsText = await this.getMentionsText(
      mentionIds,
      ext.customMentionsLegales,
      ext.mentionPlaceholderValues
    );
    const colors = template?.colors || { primary: '#1e3a8a', border: '#e5e7eb' };

    const content = [
      ...buildHeaderContent(emetteur, template),
      { text: `DEVIS N° ${devis.numero}`, style: 'title' },
      { text: `Date: ${devis.dateEmission.toLocaleDateString('fr-FR')}` },
      { text: `Validité: ${devis.dateValidite.toLocaleDateString('fr-FR')}` },
      { text: '\n' },
      { text: 'Client:', style: 'subheader' },
      { text: clientName || 'Client inconnu' },
      { text: '\n' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Désignation', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
              { text: 'Qté', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
              { text: 'Prix U. HT', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
              { text: 'TVA', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
              { text: 'Total HT', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
            ],
            ...buildPostesRows(devis.postes),
          ],
        },
        layout: buildTableLayout(template),
      },
      { text: '\n' },
      { text: `Total HT: ${formatCurrency(devis.totalHT)}`, alignment: 'right' },
      {
        text: `Total TVA: ${formatCurrency(
          Object.values(devis.totalTVA).reduce((a, b) => a + b, 0)
        )}`,
        alignment: 'right',
      },
      { text: `Total TTC: ${formatCurrency(devis.totalTTC)}`, style: 'total', alignment: 'right' },
      { text: '\n' },
      { text: devis.conditionsPaiement || '', style: 'mentions' },
      { text: mentionsText || devis.mentionsLegales || '', style: 'mentions' },
    ];

    const docDefinition: TDocumentDefinitions = {
      ...buildStyledDocDefinition(content, template),
      content,
    } as TDocumentDefinitions;

    const pdfDoc = pdfMake.createPdf(docDefinition);
    const blob = await getPdfBlob(pdfDoc);
    const base64 = await blobToBase64(blob);
    const fileName = `${devis.numero.replace(/[/\\?*:|"]/g, '_')}.pdf`;
    const relativePath = `data/attachments/${fileName}`;
    if (isElectronAvailable()) {
      const writeResult = await window.electronAPI.writeBinaryFile(relativePath, base64);
      if (!writeResult.success) {
        throw new Error(writeResult.error || 'Erreur lors de la sauvegarde du PDF');
      }
      return { path: relativePath, name: fileName };
    }
    throw new Error('Electron non disponible');
  }

  static async generateFacturePDF(
    facture: Facture,
    emetteur: Emetteur | EmetteurExtended,
    options?: { templateId?: string; mentionIds?: string[] }
  ): Promise<void> {
    await loadFonts();
    const client = await ClientService.getClientById(facture.clientId);
    const clientName =
      client?.denominationSociale || `${client?.prenom || ''} ${client?.nom || ''}`.trim();

    const ext = emetteur as EmetteurExtended;
    const templateId = ext.pdfTemplateFacture ?? options?.templateId;
    const template = await this.getTemplate(templateId);
    const mentionIds = ext.selectedMentionsLegales ?? options?.mentionIds;
    const mentionsText = await this.getMentionsText(
      mentionIds,
      ext.customMentionsLegales,
      ext.mentionPlaceholderValues
    );
    const colors = template?.colors || { primary: '#1e3a8a', border: '#e5e7eb' };

    const content = [
      ...buildHeaderContent(emetteur, template),
      { text: `FACTURE N° ${facture.numero}`, style: 'title' },
      { text: `Date: ${facture.dateEmission.toLocaleDateString('fr-FR')}` },
      { text: '\n' },
      { text: 'Client:', style: 'subheader' },
      { text: clientName || 'Client inconnu' },
      { text: '\n' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Désignation', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
              { text: 'Qté', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
              { text: 'Prix U. HT', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
              { text: 'TVA', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
              { text: 'Total HT', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
            ],
            ...buildPostesRows(facture.postes),
          ],
        },
        layout: buildTableLayout(template),
      },
      { text: '\n' },
      { text: `Total HT: ${formatCurrency(facture.totalHT)}`, alignment: 'right' },
      {
        text: `Total TVA: ${formatCurrency(
          Object.values(facture.totalTVA).reduce((a, b) => a + b, 0)
        )}`,
        alignment: 'right',
      },
      { text: `Total TTC: ${formatCurrency(facture.totalTTC)}`, style: 'total', alignment: 'right' },
      { text: '\n' },
      { text: facture.conditionsPaiement || '', style: 'mentions' },
      { text: mentionsText || facture.mentionsLegales || '', style: 'mentions' },
    ];

    const docDefinition: TDocumentDefinitions = {
      ...buildStyledDocDefinition(content, template),
      content,
    } as TDocumentDefinitions;

    await saveOrDownloadPdf(docDefinition, `${facture.numero}.pdf`);
  }

  static async generateFacturePDFToFile(
    facture: Facture,
    emetteur: Emetteur | EmetteurExtended,
    options?: { templateId?: string; mentionIds?: string[] }
  ): Promise<{ path: string; name: string }> {
    await loadFonts();
    const client = await ClientService.getClientById(facture.clientId);
    const clientName =
      client?.denominationSociale || `${client?.prenom || ''} ${client?.nom || ''}`.trim();

    const ext = emetteur as EmetteurExtended;
    const templateId = ext.pdfTemplateFacture ?? options?.templateId;
    const template = await this.getTemplate(templateId);
    const mentionIds = ext.selectedMentionsLegales ?? options?.mentionIds;
    const mentionsText = await this.getMentionsText(
      mentionIds,
      ext.customMentionsLegales,
      ext.mentionPlaceholderValues
    );
    const colors = template?.colors || { primary: '#1e3a8a', border: '#e5e7eb' };

    const content = [
      ...buildHeaderContent(emetteur, template),
      { text: `FACTURE N° ${facture.numero}`, style: 'title' },
      { text: `Date: ${facture.dateEmission.toLocaleDateString('fr-FR')}` },
      { text: '\n' },
      { text: 'Client:', style: 'subheader' },
      { text: clientName || 'Client inconnu' },
      { text: '\n' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Désignation', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
              { text: 'Qté', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
              { text: 'Prix U. HT', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
              { text: 'TVA', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
              { text: 'Total HT', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
            ],
            ...buildPostesRows(facture.postes),
          ],
        },
        layout: buildTableLayout(template),
      },
      { text: '\n' },
      { text: `Total HT: ${formatCurrency(facture.totalHT)}`, alignment: 'right' },
      {
        text: `Total TVA: ${formatCurrency(
          Object.values(facture.totalTVA).reduce((a, b) => a + b, 0)
        )}`,
        alignment: 'right',
      },
      { text: `Total TTC: ${formatCurrency(facture.totalTTC)}`, style: 'total', alignment: 'right' },
      { text: '\n' },
      { text: facture.conditionsPaiement || '', style: 'mentions' },
      { text: mentionsText || facture.mentionsLegales || '', style: 'mentions' },
    ];

    const docDefinition: TDocumentDefinitions = {
      ...buildStyledDocDefinition(content, template),
      content,
    } as TDocumentDefinitions;

    const pdfDoc = pdfMake.createPdf(docDefinition);
    const blob = await getPdfBlob(pdfDoc);
    const base64 = await blobToBase64(blob);
    const fileName = `${facture.numero.replace(/[/\\?*:|"]/g, '_')}.pdf`;
    const relativePath = `data/attachments/${fileName}`;
    if (isElectronAvailable()) {
      const writeResult = await window.electronAPI.writeBinaryFile(relativePath, base64);
      if (!writeResult.success) {
        throw new Error(writeResult.error || 'Erreur lors de la sauvegarde du PDF');
      }
      return { path: relativePath, name: fileName };
    }
    throw new Error('Electron non disponible');
  }
}
