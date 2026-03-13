import pdfMake from 'pdfmake/build/pdfmake';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { PDFTemplate } from '../types/Invoice';
import { AssociationConfig, Donateur, Don, NatureDon, ModeVersement, DONATEUR_ANONYME_ID } from '../types/Association';
import { Project, CategoryChargesData, Subscription } from '../types/ProjectManagement';
import { Transaction } from '../types/Transaction';
import { AssociationConfigService } from './AssociationConfigService';
import { DonateurService } from './DonateurService';
import { DonsService } from './DonsService';
import { DataService } from './DataService';
import { PDFTemplateService } from './PDFTemplateService';
import { RegistreRecusService } from './RegistreRecusService';
import { ProjectionService } from './ProjectionService';

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
    const fonts = (pdfFonts as any).default;
    if (fonts?.pdfMake?.vfs) {
      setPdfMakeVfs(fonts.pdfMake.vfs);
      fontsLoaded = true;
    } else if (fonts?.vfs) {
      setPdfMakeVfs(fonts.vfs);
      fontsLoaded = true;
    }
  } catch (error) {
    console.warn('Impossible de charger les fonts pdfmake:', error);
  }
};

const formatCurrency = (value: number) => `${value.toFixed(2).replace('.', ',')} €`;

const formatAdresse = (a: { rue: string; codePostal: string; ville: string; pays: string }) =>
  [a.rue, `${a.codePostal} ${a.ville}`.trim(), a.pays].filter(Boolean).join(', ');

/** Normalise la date de fin en fin de journée pour inclure toutes les opérations du jour */
const endOfDay = (d: Date): Date => {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
};

const getDonateurLabel = (d: Donateur) =>
  d.denominationSociale || `${d.prenom || ''} ${d.nom || ''}`.trim() || 'Donateur inconnu';

/** Date à afficher pour un don (date de perception si renseignée, sinon date du don) */
const getDonDisplayDate = (don: Don): Date =>
  don.datePerception
    ? don.datePerception instanceof Date
      ? don.datePerception
      : new Date(don.datePerception)
    : don.date instanceof Date
      ? don.date
      : new Date(don.date);

const RECUS_BANK_PATH = 'data/association_recus';

const isElectronAvailable = () =>
  typeof window !== 'undefined' &&
  typeof window.electronAPI?.saveFile === 'function' &&
  typeof window.electronAPI?.writeBinaryFile === 'function';

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Format invalide'));
        return;
      }
      const base64 = result.split(',')[1];
      resolve(base64 || '');
    };
    reader.onerror = () => reject(new Error('Impossible de lire le PDF'));
    reader.readAsDataURL(blob);
  });

const getPdfBlob = async (pdfDoc: ReturnType<typeof pdfMake.createPdf>): Promise<Blob> => {
  const result = (pdfDoc as any).getBlob?.();
  if (result != null && typeof result.then === 'function') return result as Promise<Blob>;
  return new Promise((resolve, reject) => {
    (pdfDoc as any).getBlob((blob: Blob) => resolve(blob), (err?: unknown) => reject(err));
  });
};

/** Charge le template PDF (reçu fiscal ou défaut) comme pour la page Entreprise */
const getTemplate = async (templateId?: string): Promise<PDFTemplate | undefined> => {
  if (templateId) {
    const template = await PDFTemplateService.getTemplateById(templateId);
    if (template) return template;
  }
  const templates = await PDFTemplateService.loadTemplates();
  return templates.find((t) => t.isDefault) || templates[0];
};

// ─── Montant en lettres (français) ──────────────────────────────────────────

const UNITES = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
];
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

const moinsDeCent = (n: number): string => {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (d === 7) return 'soixante-' + UNITES[10 + u];
  if (d === 8) return u === 0 ? 'quatre-vingts' : 'quatre-vingt-' + UNITES[u];
  if (d === 9) return 'quatre-vingt-' + UNITES[10 + u];
  if (u === 0) return DIZAINES[d];
  if (u === 1) return DIZAINES[d] + '-et-un';
  return DIZAINES[d] + '-' + UNITES[u];
};

const moinsDeMille = (n: number): string => {
  if (n < 100) return moinsDeCent(n);
  const c = Math.floor(n / 100);
  const r = n % 100;
  const centStr = c === 1 ? 'cent' : UNITES[c] + ' cent' + (r === 0 && c > 1 ? 's' : '');
  return r === 0 ? centStr : centStr + ' ' + moinsDeCent(r);
};

export const montantEnLettres = (value: number): string => {
  const entier = Math.round(value);
  const centimes = Math.round((value - Math.floor(value)) * 100);

  if (entier === 0 && centimes === 0) return 'zéro euro';

  let result = '';
  if (entier >= 1_000_000) {
    const millions = Math.floor(entier / 1_000_000);
    const reste = entier % 1_000_000;
    result += moinsDeMille(millions) + (millions > 1 ? ' millions' : ' million');
    if (reste > 0) result += ' ' + partieEntiere(reste);
  } else {
    result = partieEntiere(entier);
  }

  result += entier > 1 ? ' euros' : ' euro';

  if (centimes > 0) {
    result += ' et ' + moinsDeCent(centimes) + (centimes > 1 ? ' centimes' : ' centime');
  }

  return result.charAt(0).toUpperCase() + result.slice(1);
};

const partieEntiere = (n: number): string => {
  if (n === 0) return 'zéro';
  if (n < 1000) return moinsDeMille(n);
  const milliers = Math.floor(n / 1000);
  const reste = n % 1000;
  const milliersStr = milliers === 1 ? 'mille' : moinsDeMille(milliers) + ' mille';
  return reste === 0 ? milliersStr : milliersStr + ' ' + moinsDeMille(reste);
};

// ─── Labels lisibles pour nature/mode ────────────────────────────────────────

const NATURE_LABELS: Record<NatureDon, string> = {
  numeraire: 'Don en numéraire',
  nature: 'Don en nature',
  mecenat_competences: 'Mécénat de compétences',
};

const MODE_LABELS: Record<ModeVersement, string> = {
  virement: 'Virement bancaire',
  cheque: 'Chèque',
  especes: 'Espèces',
  cb: 'Carte bancaire',
  prelevement: 'Prélèvement',
  autre: 'Autre',
};

const PERIODICITY_LABELS: Record<string, string> = {
  daily: 'Quotidien',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  yearly: 'Annuel',
  unique: 'Unique',
};

// ─── En-tête et mise en page ─────────────────────────────────────────────────

/** En-tête PDF association – même logique que buildHeaderContent (Entreprise) avec template */
const buildAssociationHeaderContent = (
  config: AssociationConfig,
  template?: PDFTemplate
): any[] => {
  const colors = template?.colors || {
    primary: '#1e3a8a',
    secondary: '#475569',
    text: '#1f2937',
  };

  const textStack: any[] = [
    { text: config.denominationSociale || 'Association', style: 'header', color: colors.primary },
  ];
  if (config.formeJuridique) {
    textStack.push({ text: config.formeJuridique, color: colors.secondary, fontSize: 9 });
  }
  if (config.adresse && (config.adresse.rue || config.adresse.ville)) {
    textStack.push({
      text: formatAdresse(config.adresse),
      color: colors.secondary,
      fontSize: template?.typography?.fontSize?.body ?? 10,
    });
  }
  if (config.rna) {
    textStack.push({ text: `RNA : ${config.rna}`, color: colors.secondary, fontSize: 9 });
  }
  if (config.siren) {
    textStack.push({ text: `SIREN : ${config.siren}`, color: colors.secondary, fontSize: 9 });
  }
  if (config.siret) {
    textStack.push({ text: `SIRET : ${config.siret}`, color: colors.secondary, fontSize: 9 });
  }

  if (config.logo) {
    const logoWidth = template?.layout?.logoSize?.width || 120;
    const logoPosition = template?.layout?.logoPosition || 'left';

    if (logoPosition === 'center') {
      return [
        { image: config.logo, width: logoWidth, alignment: 'center', margin: [0, 0, 0, 10] },
        { stack: textStack, alignment: 'center' },
        { text: '\n' },
      ];
    }
    if (logoPosition === 'right') {
      return [
        {
          columns: [
            { stack: textStack },
            { image: config.logo, width: logoWidth, alignment: 'right' },
          ],
          columnGap: 20,
        },
        { text: '\n' },
      ];
    }
    return [
      {
        columns: [
          { image: config.logo, width: logoWidth },
          { stack: textStack, alignment: 'right' },
        ],
        columnGap: 12,
      },
      { text: '\n' },
    ];
  }

  return [...textStack, { text: '\n' }];
};

/** Styles et mise en page du document – alignés sur PDFService.buildStyledDocDefinition */
const buildAssociationDocDefinition = (
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

  const pageSize = template?.format === 'Letter' ? 'LETTER' : (template?.format || 'A4');
  const pageMargins: [number, number, number, number] = template?.layout?.margins
    ? [
        template.layout.margins.left,
        template.layout.margins.top,
        template.layout.margins.right,
        template.layout.margins.bottom,
      ]
    : [40, 40, 40, 40];

  return {
    pageSize,
    pageOrientation: template?.orientation || 'portrait',
    pageMargins,
    content,
    styles: {
      header: { fontSize: fontSize.title, bold: true, color: colors.primary },
      title: {
        fontSize: fontSize.header + 2,
        bold: true,
        margin: [0, 10, 0, 10],
        color: colors.primary,
      },
      subheader: {
        fontSize: fontSize.header,
        bold: true,
        margin: [0, 8, 0, 4],
        color: colors.primary,
      },
      tableHeader: { fontSize: fontSize.body, bold: true },
      mentions: { fontSize: fontSize.footer, color: colors.secondary },
    },
    defaultStyle: {
      fontSize: fontSize.body,
      color: colors.text,
    },
  };
};

/** Layout des tableaux – bordures et couleurs comme Entreprise */
const buildAssociationTableLayout = (template?: PDFTemplate) => {
  const colors = template?.colors || { primary: '#1e3a8a', border: '#e5e7eb' };
  const borderColor = colors.border || '#e5e7eb';

  return {
    hLineWidth: (i: number, node: any) =>
      i === 0 || i === 1 || i === node.table.body.length ? 0.75 : 0.25,
    vLineWidth: () => 0.25,
    hLineColor: () => borderColor,
    vLineColor: () => borderColor,
    fillColor: (rowIndex: number) => {
      if (rowIndex === 0) return colors.primary;
      return rowIndex % 2 === 1 ? '#f8fafc' : null;
    },
  };
};

/** Bloc de mentions légales de pied de reçu (CERFA, RGPD, signataire) */
const buildMentionsLegales = (
  config: AssociationConfig,
  donateur: Donateur | null,
  numero: string,
  fontSize: { body: number; footer: number },
  colors: { secondary: string }
): any[] => {
  const isEntreprise = donateur?.type === 'entreprise';
  const articleCGI = isEntreprise
    ? 'article 238 bis du code général des impôts'
    : 'article 200 du code général des impôts';

  const items: any[] = [
    { text: '\n' },
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }],
      margin: [0, 0, 0, 6],
    },
    {
      text: `Reçu n° ${numero} — Émis le ${new Date().toLocaleDateString('fr-FR')} — Cerfa n°11580*05`,
      style: 'mentions',
      fontSize: fontSize.footer,
      bold: true,
      margin: [0, 0, 0, 4],
    },
    {
      text: `Le bénéficiaire certifie sur l'honneur que les dons et versements reçus ouvrent droit à la réduction d'impôt prévue à l'${articleCGI}.`,
      style: 'mentions',
      fontSize: fontSize.footer,
      margin: [0, 0, 0, 2],
    },
    {
      text: "Attestation : les dons listés sur ce document n'ont donné lieu à aucune contrepartie directe ou indirecte (bien, service, avantage…) au profit du donateur.",
      style: 'mentions',
      fontSize: fontSize.footer,
      margin: [0, 0, 0, 2],
    },
  ];

  if (config.statutOIG) {
    const joMention = config.datePublicationJO
      ? ` (Journal Officiel du ${config.datePublicationJO})`
      : '';
    items.push({
      text: `Organisme d'intérêt général au sens des articles 200 et 238 bis du CGI${joMention}.`,
      style: 'mentions',
      fontSize: fontSize.footer,
      margin: [0, 0, 0, 2],
    });
  }

  if (config.referencesCGI) {
    items.push({
      text: config.referencesCGI,
      style: 'mentions',
      fontSize: fontSize.footer,
      margin: [0, 0, 0, 6],
    });
  }

  // Zone de signature
  const sigNom = config.signataireNom || '________________________';
  const sigQualite = config.signataireQualite || 'Le représentant légal';
  items.push({
    columns: [
      { width: '*', text: '' },
      {
        width: 'auto',
        stack: [
          { text: sigQualite, fontSize: fontSize.footer, color: colors.secondary },
          { text: sigNom, fontSize: fontSize.body, bold: true, margin: [0, 2, 0, 0] },
          { text: '\n\n_________________________', fontSize: fontSize.footer, color: colors.secondary },
          { text: 'Signature et cachet', fontSize: fontSize.footer - 1, color: colors.secondary, italics: true },
        ],
        alignment: 'center',
        margin: [0, 6, 0, 0],
      },
    ],
  });

  // Mention RGPD
  items.push({
    text: "Vos données personnelles sont traitées conformément au RGPD (Règlement UE 2016/679) et à la loi Informatique et Libertés. Vous disposez d'un droit d'accès, de rectification et de suppression en contactant l'association.",
    style: 'mentions',
    fontSize: fontSize.footer - 1,
    color: '#9ca3af',
    margin: [0, 8, 0, 0],
    italics: true,
  });

  return items;
};

// ─── État récapitulatif annuel ────────────────────────────────────────────────

export interface DeclarationAnnuelleData {
  annee: number;
  totalDons: number;
  nbDonateurs: number;
  nbParticuliers: number;
  nbEntreprises: number;
  totalParticuliers: number;
  totalEntreprises: number;
  items: DonRecapItem[];
}

export interface DonRecapItem {
  donateur: Donateur;
  transactions: Transaction[];
  dons: Don[];
  total: number;
}

export class AssociationPDFService {
  static async getDonsByDonateur(
    startDate: Date,
    endDate: Date
  ): Promise<DonRecapItem[]> {
    const [donateurs, transactions, mapping, allDons] = await Promise.all([
      DonateurService.loadDonateurs(),
      DataService.getTransactions(),
      DonateurService.loadTransactionMapping(),
      DonsService.loadDons(),
    ]);

    const txById = new Map(transactions.map((t) => [t.id, t]));
    const donorsByDonateur = new Map<string, DonRecapItem>();
    const end = endOfDay(endDate);

    // Transactions bancaires
    for (const [txId, donateurId] of Object.entries(mapping)) {
      const tx = txById.get(txId);
      if (!tx || tx.amount <= 0) continue;

      const d = new Date(tx.date);
      if (d < startDate || d > end) continue;

      const donateur = donateurs.find((d) => d.id === donateurId);
      if (!donateur) continue;

      let item = donorsByDonateur.get(donateurId);
      if (!item) {
        item = { donateur, transactions: [], dons: [], total: 0 };
        donorsByDonateur.set(donateurId, item);
      }
      item.transactions.push(tx);
      item.total += tx.amount;
    }

    // Dons manuels (hors anonymes)
    for (const don of allDons) {
      if (don.donateurId === DONATEUR_ANONYME_ID) continue;
      const dt = don.date instanceof Date ? don.date : new Date(don.date);
      if (dt < startDate || dt > end) continue;

      const donateur = donateurs.find((d) => d.id === don.donateurId);
      if (!donateur) continue;

      let item = donorsByDonateur.get(don.donateurId);
      if (!item) {
        item = { donateur, transactions: [], dons: [], total: 0 };
        donorsByDonateur.set(don.donateurId, item);
      }
      item.dons.push(don);
      item.total += don.montant;
    }

    return Array.from(donorsByDonateur.values()).sort((a, b) => b.total - a.total);
  }

  /**
   * Génère un PDF récapitulatif des dons (conforme CERFA 11580*05 / 16216*01)
   * Utilise le modèle de configuration PDF de la page Entreprise (templates, couleurs, marges).
   */
  static async generateRecapPDF(startDate: Date, endDate: Date): Promise<void> {
    await loadFonts();

    const config = await AssociationConfigService.getOrCreateConfig();
    const template = await getTemplate(config.pdfTemplateRecuFiscal);
    const items = await this.getDonsByDonateur(startDate, endDate);
    const numero = await RegistreRecusService.generateNextNumero();

    let total = items.reduce((sum, i) => sum + i.total, 0);
    const formatDate = (d: Date) => d.toLocaleDateString('fr-FR');
    const colors = template?.colors || { primary: '#1e3a8a', secondary: '#475569' };
    const fontSize = template?.typography?.fontSize || { body: 10, footer: 8, title: 18, header: 14 };

    const content: any[] = [
      ...buildAssociationHeaderContent(config, template),
      config.objetSocial && {
        text: config.objetSocial,
        fontSize: fontSize.body,
        color: colors.secondary,
        margin: [0, 0, 0, 4],
      },
      {
        columns: [
          { text: 'RÉCAPITULATIF DES DONS', style: 'title', width: '*' },
          {
            stack: [
              { text: `N° ${numero}`, fontSize: fontSize.body, bold: true, alignment: 'right' },
              { text: `Exercice ${new Date().getFullYear()}`, fontSize: fontSize.footer, color: colors.secondary, alignment: 'right' },
            ],
            width: 'auto',
          },
        ],
        columnGap: 10,
      },
      { text: `Période du ${formatDate(startDate)} au ${formatDate(endDate)}`, fontSize: fontSize.body },
      { text: '\n' },
    ];

    if (items.length === 0) {
      content.push({
        text: 'Aucun don enregistré pour cette période.',
        italics: true,
        color: colors.secondary,
      });
    } else {
      const tableBody: any[][] = [
        [
          { text: 'Donateur', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
          { text: 'Date', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
          { text: 'Description', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
          { text: 'Montant', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff', alignment: 'right' },
        ],
      ];

      for (const item of items) {
        const donateurName = getDonateurLabel(item.donateur);
        const sortedTx = [...item.transactions].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        const sortedDons = [...item.dons].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        let firstRow = true;
        for (const tx of sortedTx) {
          tableBody.push([
            firstRow ? donateurName : '',
            { text: formatDate(new Date(tx.date)), fontSize: fontSize.body },
            { text: (tx.description || '').slice(0, 50), fontSize: fontSize.body },
            { text: formatCurrency(tx.amount), alignment: 'right' as const },
          ]);
          firstRow = false;
        }
        for (const don of sortedDons) {
          const dt = getDonDisplayDate(don);
          const natureStr = { nature: '[Nature]', mecenat_competences: '[Mécénat]', numeraire: '[Numéraire]' }[don.natureDon] || '';
          tableBody.push([
            firstRow ? donateurName : '',
            { text: formatDate(dt), fontSize: fontSize.body },
            { text: `${natureStr} ${(don.description || '').slice(0, 45)}`, fontSize: fontSize.body, italics: true },
            { text: formatCurrency(don.montant), alignment: 'right' as const },
          ]);
          firstRow = false;
        }
        tableBody.push([
          { text: `Sous-total ${donateurName}`, colSpan: 3, italics: true },
          {},
          {},
          { text: formatCurrency(item.total), alignment: 'right' as const, bold: true },
        ]);
      }

      // Dons anonymes sur la période
      const allDonsAnonymes = await DonsService.getDonsAnonymes();
      const end2 = endOfDay(endDate);
      const anonymesPeriode = allDonsAnonymes.filter((d) => {
        const dt = d.date instanceof Date ? d.date : new Date(d.date);
        return dt >= startDate && dt <= end2;
      });
      if (anonymesPeriode.length > 0) {
        const totalAnon = anonymesPeriode.reduce((s, d) => s + d.montant, 0);
        for (let i = 0; i < anonymesPeriode.length; i++) {
          const don = anonymesPeriode[i];
          const dt = getDonDisplayDate(don);
          const natureStr = { nature: '[Nature]', mecenat_competences: '[Mécénat]', numeraire: '[Numéraire]' }[don.natureDon] || '';
          tableBody.push([
            i === 0 ? 'Dons non identifiés' : '',
            { text: formatDate(dt), fontSize: fontSize.body },
            { text: `${natureStr} ${(don.donorLabel ? don.donorLabel + ' — ' : '')}${(don.description || '').slice(0, 40)}`, fontSize: fontSize.body, italics: true },
            { text: formatCurrency(don.montant), alignment: 'right' as const },
          ]);
        }
        tableBody.push([
          { text: 'Sous-total Dons non identifiés', colSpan: 3, italics: true },
          {},
          {},
          { text: formatCurrency(totalAnon), alignment: 'right' as const, bold: true },
        ]);
        total += totalAnon;
      }

      tableBody.push([
        { text: 'TOTAL DES DONS', colSpan: 3, bold: true },
        {},
        {},
        { text: formatCurrency(total), alignment: 'right' as const, bold: true },
      ]);

      content.push({
        table: {
          headerRows: 1,
          widths: ['*', 'auto', '*', 'auto'],
          body: tableBody,
        },
        layout: buildAssociationTableLayout(template),
      });

      // Montant total en lettres
      content.push({
        text: `Total en lettres : ${montantEnLettres(total)}`,
        fontSize: fontSize.body,
        italics: true,
        margin: [0, 6, 0, 0],
      });
    }

    content.push(
      ...buildMentionsLegales(config, null, numero, fontSize, colors)
    );

    const docDefinition: TDocumentDefinitions = {
      ...buildAssociationDocDefinition(content, template),
      content,
    } as TDocumentDefinitions;

    const pdfDoc = pdfMake.createPdf(docDefinition);
    const blob = await getPdfBlob(pdfDoc);
    const base64 = await blobToBase64(blob);
    const fileName = `Recap_Dons_${numero.replace(/[/\\]/g, '-')}_${formatDate(startDate).replace(/\//g, '-')}_${formatDate(endDate).replace(/\//g, '-')}.pdf`;
    const bankPath = `${RECUS_BANK_PATH}/${fileName}`;

    // Enregistrer dans le registre + banque PDF
    if (items.length > 0) {
      if (isElectronAvailable()) {
        const writeResult = await window.electronAPI!.writeBinaryFile!(bankPath, base64);
        if (!writeResult.success) {
          throw new Error(writeResult.error || 'Erreur sauvegarde PDF banque');
        }
      }
      const total2 = items.reduce((s, i) => s + i.total, 0);
      await RegistreRecusService.addEntry({
        numero,
        donateurId: 'RECAP',
        donateurLabel: `Récapitulatif global (${items.length} donateur(s))`,
        montant: total2,
        date: startDate.toISOString(),
        dateEmission: new Date().toISOString(),
        pdfPath: isElectronAvailable() ? bankPath : undefined,
      });
    }

    if (isElectronAvailable()) {
      const result = await window.electronAPI!.saveFile!({
        defaultPath: fileName,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (!result.success || !result.path) return;
      const writeResult = await window.electronAPI!.writeBinaryFile!(result.path, base64);
      if (!writeResult.success) {
        throw new Error(writeResult.error || 'Erreur sauvegarde PDF');
      }
    } else {
      pdfDoc.download(`Recap_Dons_${formatDate(startDate)}_${formatDate(endDate)}.pdf`);
    }
  }

  /**
   * Génère un PDF récapitulatif pour un donateur (transactions liées à ce donateur sur la période).
   * Utilise le mapping transaction → donateur (pas la catégorie).
   * @param skipUserSave si true, n'ouvre pas la boîte de sauvegarde (utilisé pour le batch)
   */
  static async generateDonateurPDF(
    donateur: Donateur,
    startDate: Date,
    endDate: Date,
    natureDon?: NatureDon,
    modeVersement?: ModeVersement,
    skipUserSave?: boolean
  ): Promise<void> {
    await loadFonts();

    const config = await AssociationConfigService.getOrCreateConfig();
    const template = await getTemplate(config.pdfTemplateRecuFiscal);
    const [allTransactions, mapping, donsManuel] = await Promise.all([
      DataService.getTransactions(),
      DonateurService.loadTransactionMapping(),
      DonsService.getDonsByDonateur(donateur.id),
    ]);

    const linkedTxIds = Object.entries(mapping)
      .filter(([, dId]) => dId === donateur.id)
      .map(([txId]) => txId);
    const linkedTxSet = new Set(linkedTxIds);
    const endDt = endOfDay(endDate);

    const filtered = allTransactions.filter((tx) => {
      if (!linkedTxSet.has(tx.id) || tx.amount <= 0) return false;
      const d = new Date(tx.date);
      return d >= startDate && d <= endDt;
    });

    const filteredDons = donsManuel.filter((d) => {
      const dt = d.date instanceof Date ? d.date : new Date(d.date);
      return dt >= startDate && dt <= endDt;
    });

    const totalTx = filtered.reduce((sum, tx) => sum + tx.amount, 0);
    const totalDonsNature = filteredDons.reduce((sum, d) => sum + d.montant, 0);
    const total = totalTx + totalDonsNature;
    const fmtDate = (d: Date) => d.toLocaleDateString('fr-FR');
    const donateurLabel = getDonateurLabel(donateur);
    const colors = template?.colors || { primary: '#1e3a8a', secondary: '#475569' };
    const fontSize = template?.typography?.fontSize || { body: 10, footer: 8, title: 18, header: 14 };

    const numero = await RegistreRecusService.generateNextNumero();

    const isEntreprise = donateur.type === 'entreprise';
    const articleCGILabel = isEntreprise
      ? 'Don ouvrant droit à réduction IS (art. 238 bis CGI)'
      : 'Don ouvrant droit à réduction IR (art. 200 CGI)';

    const content: any[] = [
      ...buildAssociationHeaderContent(config, template),
      config.objetSocial && {
        text: config.objetSocial,
        fontSize: fontSize.body,
        color: colors.secondary,
        margin: [0, 0, 0, 4],
      },
      {
        columns: [
          { text: 'REÇU AU TITRE DES DONS', style: 'title', width: '*' },
          {
            stack: [
              { text: `N° ${numero}`, fontSize: fontSize.body, bold: true, alignment: 'right' },
              { text: articleCGILabel, fontSize: fontSize.footer, color: colors.secondary, alignment: 'right' },
            ],
            width: 'auto',
          },
        ],
        columnGap: 10,
      },
      {
        table: {
          widths: ['*', '*'],
          body: [
            [
              {
                stack: [
                  { text: 'DONATEUR', fontSize: fontSize.footer, bold: true, color: colors.secondary },
                  { text: donateurLabel, fontSize: fontSize.body, bold: true },
                  ...(donateur.adresse && (donateur.adresse.rue || donateur.adresse.ville)
                    ? [{ text: formatAdresse(donateur.adresse), fontSize: fontSize.footer, color: colors.secondary }]
                    : []),
                  ...(donateur.siren ? [{ text: `SIREN : ${donateur.siren}`, fontSize: fontSize.footer, color: colors.secondary }] : []),
                ],
                border: [true, true, false, true],
                fillColor: '#f8fafc',
                margin: [8, 6, 8, 6],
              },
              {
                stack: [
                  { text: 'PÉRIODE', fontSize: fontSize.footer, bold: true, color: colors.secondary },
                  { text: `Du ${fmtDate(startDate)} au ${fmtDate(endDate)}`, fontSize: fontSize.body },
                  ...(natureDon ? [{ text: NATURE_LABELS[natureDon] || natureDon, fontSize: fontSize.footer, color: colors.secondary }] : []),
                  ...(modeVersement ? [{ text: MODE_LABELS[modeVersement] || modeVersement, fontSize: fontSize.footer, color: colors.secondary }] : []),
                ],
                border: [false, true, true, true],
                fillColor: '#f8fafc',
                margin: [8, 6, 8, 6],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#e5e7eb',
          vLineColor: () => '#e5e7eb',
        },
        margin: [0, 0, 0, 10],
      },
    ];

    if (filtered.length === 0 && filteredDons.length === 0) {
      content.push({
        text: 'Aucun don enregistré pour ce donateur sur cette période.',
        italics: true,
        color: colors.secondary,
      });
    } else {
      const tableBody: any[][] = [
        [
          { text: 'Date', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
          { text: 'Nature', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
          { text: 'Description', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
          { text: 'Montant', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff', alignment: 'right' },
        ],
      ];

      const allRows: Array<{ date: Date; nature: string; description: string; montant: number }> = [];

      for (const tx of filtered) {
        allRows.push({
          date: new Date(tx.date),
          nature: 'Numéraire',
          description: (tx.description || '').slice(0, 55),
          montant: tx.amount,
        });
      }
      for (const don of filteredDons) {
        const dt = getDonDisplayDate(don);
        const natureLabel = { nature: 'Don en nature', mecenat_competences: 'Mécénat', numeraire: 'Numéraire' }[don.natureDon] || don.natureDon;
        allRows.push({
          date: dt,
          nature: natureLabel,
          description: (don.description || '').slice(0, 55),
          montant: don.montant,
        });
      }
      allRows.sort((a, b) => b.date.getTime() - a.date.getTime());

      for (const row of allRows) {
        tableBody.push([
          { text: fmtDate(row.date), fontSize: fontSize.body },
          { text: row.nature, fontSize: fontSize.footer, color: colors.secondary },
          { text: row.description, fontSize: fontSize.body },
          { text: formatCurrency(row.montant), alignment: 'right' as const },
        ]);
      }

      tableBody.push([
        { text: 'TOTAL', colSpan: 3, bold: true },
        {},
        {},
        { text: formatCurrency(total), alignment: 'right' as const, bold: true },
      ]);

      content.push({
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', '*', 'auto'],
          body: tableBody,
        },
        layout: buildAssociationTableLayout(template),
      });

      // Montant en lettres
      content.push({
        text: `Montant en lettres : ${montantEnLettres(total)}`,
        fontSize: fontSize.body,
        italics: true,
        margin: [0, 6, 0, 0],
      });

      // Détail par nature si dons en nature présents
      if (filteredDons.some((d) => d.natureDon !== 'numeraire')) {
        const parNature = new Map<string, number>();
        for (const don of filteredDons) {
          parNature.set(don.natureDon, (parNature.get(don.natureDon) || 0) + don.montant);
        }
        if (totalTx > 0) parNature.set('numeraire_tx', totalTx);
        content.push({
          text: 'Répartition par nature :',
          fontSize: fontSize.footer,
          bold: true,
          margin: [0, 8, 0, 2],
          color: colors.secondary,
        });
        for (const [nature, montantNature] of parNature.entries()) {
          const label = { nature: 'Dons en nature', mecenat_competences: 'Mécénat de compétences', numeraire: 'Dons numéraires', numeraire_tx: 'Numéraire (transactions)' }[nature] || nature;
          content.push({
            text: `  • ${label} : ${formatCurrency(montantNature)}`,
            fontSize: fontSize.footer,
            color: colors.secondary,
          });
        }
      }
    }

    content.push(
      ...buildMentionsLegales(config, donateur, numero, fontSize, colors)
    );

    const docDefinition: TDocumentDefinitions = {
      ...buildAssociationDocDefinition(content, template),
      content,
    } as TDocumentDefinitions;

    const pdfDoc = pdfMake.createPdf(docDefinition);
    const safeName = donateurLabel
      .replace(/[^a-zA-Z0-9àâéèêëîïôùûüç\s-]/gi, '')
      .replace(/\s+/g, '_');
    const fileName = `Recu_${numero}_${safeName}_${fmtDate(startDate).replace(/\//g, '-')}_${fmtDate(endDate).replace(/\//g, '-')}.pdf`;
    const bankPath = `${RECUS_BANK_PATH}/${fileName}`;

    let base64: string | null = null;
    if (isElectronAvailable()) {
      const blob = await getPdfBlob(pdfDoc);
      base64 = await blobToBase64(blob);
      const writeBankResult = await window.electronAPI!.writeBinaryFile!(bankPath, base64);
      if (!writeBankResult.success) {
        throw new Error(writeBankResult.error || 'Erreur sauvegarde PDF banque');
      }
    }

    // Enregistrer dans le registre
    await RegistreRecusService.addEntry({
      numero,
      donateurId: donateur.id,
      donateurLabel,
      montant: total,
      date: startDate.toISOString(),
      dateEmission: new Date().toISOString(),
      natureDon,
      modeVersement,
      pdfPath: isElectronAvailable() ? bankPath : undefined,
    });

    if (!skipUserSave) {
      if (isElectronAvailable() && base64) {
        const result = await window.electronAPI!.saveFile!({
          defaultPath: fileName,
          filters: [{ name: 'PDF', extensions: ['pdf'] }],
        });
        if (!result.success || !result.path) return;
        const writeResult = await window.electronAPI!.writeBinaryFile!(result.path, base64);
        if (!writeResult.success) {
          throw new Error(writeResult.error || 'Erreur sauvegarde PDF');
        }
      } else {
        pdfDoc.download(fileName);
      }
    }
  }

  /**
   * Génère un PDF par donateur ayant des dons sur la période. Sauvegarde dans la banque uniquement (pas de dialog).
   */
  static async generateDonateurPDFBatch(startDate: Date, endDate: Date): Promise<number> {
    const items = await this.getDonsByDonateur(startDate, endDate);
    let count = 0;
    for (const item of items) {
      await this.generateDonateurPDF(item.donateur, startDate, endDate, undefined, undefined, true);
      count++;
    }
    return count;
  }

  /**
   * Génère un état récapitulatif annuel des dons pour la déclaration fiscale.
   * Inclut totaux par nature, répartition particuliers/entreprises, détail par donateur.
   */
  static async generateDeclarationAnnuellePDF(annee: number): Promise<void> {
    await loadFonts();

    const startDate = new Date(annee, 0, 1);
    const endDate = new Date(annee, 11, 31, 23, 59, 59, 999);

    const config = await AssociationConfigService.getOrCreateConfig();
    const template = await getTemplate(config.pdfTemplateRecuFiscal);
    const [items, allDons] = await Promise.all([
      this.getDonsByDonateur(startDate, endDate),
      DonsService.loadDons(),
    ]);

    const colors = template?.colors || { primary: '#1e3a8a', secondary: '#475569' };
    const fontSize = template?.typography?.fontSize || { body: 10, footer: 8, title: 18, header: 14 };
    const fmtDate = (d: Date) => d.toLocaleDateString('fr-FR');

    // Dons anonymes sur l'année
    const donsAnonymesAnnee = allDons.filter((d) => {
      if (d.donateurId !== DONATEUR_ANONYME_ID) return false;
      const dt = d.date instanceof Date ? d.date : new Date(d.date);
      return dt >= startDate && dt <= endDate;
    });
    const totalAnonymes = donsAnonymesAnnee.reduce((s, d) => s + d.montant, 0);

    // Répartition par nature (tous dons confondus)
    const parNature = new Map<string, number>();
    for (const item of items) {
      // transactions = numéraire
      const txTotal = item.transactions.reduce((s, tx) => s + tx.amount, 0);
      if (txTotal > 0) parNature.set('numeraire', (parNature.get('numeraire') || 0) + txTotal);
      // dons manuels
      for (const don of item.dons) {
        parNature.set(don.natureDon, (parNature.get(don.natureDon) || 0) + don.montant);
      }
    }
    for (const don of donsAnonymesAnnee) {
      parNature.set(don.natureDon, (parNature.get(don.natureDon) || 0) + don.montant);
    }

    const totalIdentifie = items.reduce((s, i) => s + i.total, 0);
    const totalDons = totalIdentifie + totalAnonymes;
    const particuliers = items.filter((i) => i.donateur.type === 'particulier');
    const entreprises = items.filter((i) => i.donateur.type === 'entreprise');
    const totalParticuliers = particuliers.reduce((s, i) => s + i.total, 0);
    const totalEntreprises = entreprises.reduce((s, i) => s + i.total, 0);

    const content: any[] = [
      ...buildAssociationHeaderContent(config, template),
      {
        columns: [
          { text: `ÉTAT RÉCAPITULATIF DES DONS — EXERCICE ${annee}`, style: 'title', width: '*' },
          {
            stack: [
              { text: `Établi le ${fmtDate(new Date())}`, fontSize: fontSize.footer, color: colors.secondary, alignment: 'right' },
              { text: `Document destiné à la déclaration fiscale`, fontSize: fontSize.footer - 1, color: colors.secondary, alignment: 'right', italics: true },
            ],
            width: 'auto',
          },
        ],
        columnGap: 10,
      },
      { text: `Période couverte : du 1er janvier ${annee} au 31 décembre ${annee}`, fontSize: fontSize.body, margin: [0, 0, 0, 12] },
    ];

    // Bloc de synthèse
    content.push(
      { text: '1. SYNTHÈSE', style: 'subheader' },
      {
        table: {
          widths: ['*', '*', '*', '*'],
          body: [
            [
              { text: 'Indicateur', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
              { text: 'Particuliers', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff', alignment: 'right' },
              { text: 'Entreprises', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff', alignment: 'right' },
              { text: 'Total', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff', alignment: 'right' },
            ],
            [
              { text: 'Nombre de donateurs', fontSize: fontSize.body },
              { text: String(particuliers.length), alignment: 'right' as const },
              { text: String(entreprises.length), alignment: 'right' as const },
              { text: String(items.length), alignment: 'right' as const, bold: true },
            ],
            [
              { text: 'Nombre de dons (transactions)', fontSize: fontSize.body },
              { text: String(particuliers.reduce((s, i) => s + i.transactions.length, 0)), alignment: 'right' as const },
              { text: String(entreprises.reduce((s, i) => s + i.transactions.length, 0)), alignment: 'right' as const },
              { text: String(items.reduce((s, i) => s + i.transactions.length, 0)), alignment: 'right' as const, bold: true },
            ],
            [
              { text: 'Montant total des dons', fontSize: fontSize.body, bold: true },
              { text: formatCurrency(totalParticuliers), alignment: 'right' as const },
              { text: formatCurrency(totalEntreprises), alignment: 'right' as const },
              { text: formatCurrency(totalDons), alignment: 'right' as const, bold: true },
            ],
            [
              { text: 'Don moyen par donateur', fontSize: fontSize.body },
              { text: formatCurrency(particuliers.length > 0 ? totalParticuliers / particuliers.length : 0), alignment: 'right' as const },
              { text: formatCurrency(entreprises.length > 0 ? totalEntreprises / entreprises.length : 0), alignment: 'right' as const },
              { text: formatCurrency(items.length > 0 ? totalDons / items.length : 0), alignment: 'right' as const },
            ],
          ],
        },
        layout: buildAssociationTableLayout(template),
        margin: [0, 0, 0, 16],
      },
      {
        text: `Montant total en lettres : ${montantEnLettres(totalDons)}`,
        fontSize: fontSize.body,
        italics: true,
        margin: [0, 0, 0, 8],
      }
    );

    // Répartition par nature
    if (parNature.size > 0) {
      const natureRows = Array.from(parNature.entries()).map(([nature, montantNature]) => {
        const label = { nature: 'Dons en nature', mecenat_competences: 'Mécénat de compétences', numeraire: 'Dons numéraires' }[nature] || nature;
        return [
          { text: label, fontSize: fontSize.body },
          { text: formatCurrency(montantNature), alignment: 'right' as const },
          { text: `${((montantNature / totalDons) * 100).toFixed(1)} %`, alignment: 'right' as const, color: colors.secondary },
        ];
      });
      natureRows.push([
        { text: 'TOTAL', bold: true, fontSize: fontSize.body } as any,
        { text: formatCurrency(totalDons), alignment: 'right' as const, bold: true } as any,
        { text: '100 %', alignment: 'right' as const, color: colors.secondary } as any,
      ]);
      content.push(
        { text: 'Répartition par nature de don :', fontSize: fontSize.footer, bold: true, color: colors.secondary, margin: [0, 0, 0, 4] },
        {
          table: {
            widths: ['*', 'auto', 'auto'],
            body: [
              [
                { text: 'Nature', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
                { text: 'Montant', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff', alignment: 'right' },
                { text: 'Part', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff', alignment: 'right' },
              ],
              ...natureRows,
            ],
          },
          layout: buildAssociationTableLayout(template),
          margin: [0, 0, 0, 20],
        }
      );
    } else {
      content.push({ text: '', margin: [0, 0, 0, 20] });
    }

    // Détail par donateur
    if (items.length > 0 || donsAnonymesAnnee.length > 0) {
      content.push({ text: '2. DÉTAIL PAR DONATEUR', style: 'subheader' });

      const tableBody: any[][] = [
        [
          { text: 'Donateur', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
          { text: 'Type', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
          { text: 'Nb dons', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff', alignment: 'right' },
          { text: 'Montant total', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff', alignment: 'right' },
          { text: 'Article CGI', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
        ],
      ];

      for (const item of items) {
        const isEnt = item.donateur.type === 'entreprise';
        const nbDons = item.transactions.length + item.dons.length;
        tableBody.push([
          {
            stack: [
              { text: getDonateurLabel(item.donateur), fontSize: fontSize.body },
              ...(item.donateur.adresse?.ville ? [{ text: item.donateur.adresse.ville, fontSize: fontSize.footer, color: colors.secondary }] : []),
            ],
          },
          { text: isEnt ? 'Entreprise' : 'Particulier', fontSize: fontSize.body },
          { text: String(nbDons), alignment: 'right' as const },
          { text: formatCurrency(item.total), alignment: 'right' as const, bold: true },
          { text: isEnt ? 'Art. 238 bis' : 'Art. 200', fontSize: fontSize.footer, color: colors.secondary },
        ]);
      }

      // Ligne dons anonymes
      if (donsAnonymesAnnee.length > 0) {
        tableBody.push([
          { text: 'Dons non identifiés', fontSize: fontSize.body, italics: true },
          { text: '—', fontSize: fontSize.body },
          { text: String(donsAnonymesAnnee.length), alignment: 'right' as const },
          { text: formatCurrency(totalAnonymes), alignment: 'right' as const, bold: true },
          { text: 'Art. 200 / 238 bis', fontSize: fontSize.footer, color: colors.secondary },
        ]);
      }

      // Total
      tableBody.push([
        { text: 'TOTAL', colSpan: 3, bold: true },
        {},
        {},
        { text: formatCurrency(totalDons), alignment: 'right' as const, bold: true },
        {},
      ]);

      content.push({
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto', 'auto'],
          body: tableBody,
        },
        layout: buildAssociationTableLayout(template),
        margin: [0, 0, 0, 20],
      });
    }

    // Attestation et mentions légales
    content.push(
      { text: '3. ATTESTATION', style: 'subheader' },
      {
        text: `Je soussigné(e), ${config.signataireNom || '________________________'}, ${config.signataireQualite || 'représentant légal'} de l'association « ${config.denominationSociale} » (RNA : ${config.rna || 'N/A'}, SIREN : ${config.siren || 'N/A'}), certifie sur l'honneur que :`,
        fontSize: fontSize.body,
        margin: [0, 0, 0, 8],
      },
      {
        ul: [
          `L'association est habilitée à recevoir des dons ouvrant droit à réduction d'impôt au titre des articles 200 et 238 bis du CGI.`,
          `Les dons listés dans ce document n'ont donné lieu à aucune contrepartie directe ou indirecte au profit des donateurs.`,
          config.statutOIG
            ? `L'association est reconnue comme organisme d'intérêt général${config.datePublicationJO ? ` (JO du ${config.datePublicationJO})` : ''}.`
            : null,
        ].filter(Boolean) as string[],
        fontSize: fontSize.body,
        margin: [0, 0, 0, 16],
      },
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 'auto',
            stack: [
              { text: `Fait à ________________________, le ${fmtDate(new Date())}`, fontSize: fontSize.body },
              { text: `\n${config.signataireQualite || 'Le représentant légal'}`, fontSize: fontSize.footer, color: colors.secondary },
              { text: config.signataireNom || '________________________', fontSize: fontSize.body, bold: true, margin: [0, 4, 0, 0] },
              { text: '\n\n_________________________', fontSize: fontSize.footer, color: colors.secondary },
              { text: 'Signature et cachet', fontSize: fontSize.footer - 1, color: colors.secondary, italics: true },
            ],
            alignment: 'center',
          },
        ],
        margin: [0, 0, 0, 16],
      },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }],
        margin: [0, 0, 0, 6],
      },
      {
        text: 'Document généré par Comptal2 — Cerfa n°11580*05 — À conserver 6 ans.',
        style: 'mentions',
        fontSize: fontSize.footer,
        bold: false,
      },
      {
        text: "Vos données personnelles sont traitées conformément au RGPD (Règlement UE 2016/679). Droit d'accès et de rectification auprès de l'association.",
        style: 'mentions',
        fontSize: fontSize.footer - 1,
        italics: true,
        color: '#9ca3af',
        margin: [0, 4, 0, 0],
      }
    );

    const docDefinition: TDocumentDefinitions = {
      ...buildAssociationDocDefinition(content, template),
      content,
    } as TDocumentDefinitions;

    const pdfDoc = pdfMake.createPdf(docDefinition);
    const fileName = `Declaration_Annuelle_Dons_${annee}.pdf`;

    if (isElectronAvailable()) {
      const blob = await getPdfBlob(pdfDoc);
      const base64 = await blobToBase64(blob);
      const result = await window.electronAPI!.saveFile!({
        defaultPath: fileName,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (!result.success || !result.path) return;
      const writeResult = await window.electronAPI!.writeBinaryFile!(result.path, base64);
      if (!writeResult.success) {
        throw new Error(writeResult.error || 'Erreur sauvegarde PDF');
      }
    } else {
      pdfDoc.download(fileName);
    }
  }

  /**
   * Génère un PDF récapitulatif des charges (mode manuel ou mode catégories).
   * Mode catégories : tableau avec données réelles par catégorie (mois, total, moyenne).
   * Mode manuel : tableau avec charges récurrentes (nom, montant, périodicité, dates).
   */
  static async generateChargesReportPDF(
    project: Project,
    categoryChargesData?: CategoryChargesData | null
  ): Promise<void> {
    await loadFonts();

    const config = await AssociationConfigService.getOrCreateConfig();
    const template = await getTemplate(config.pdfTemplateRecuFiscal);
    const colors = template?.colors || { primary: '#1e3a8a', secondary: '#475569' };
    const fontSize = template?.typography?.fontSize || { body: 10, footer: 8, title: 18, header: 14 };
    const fmtDate = (d: Date) => d.toLocaleDateString('fr-FR');

    const content: any[] = [
      ...buildAssociationHeaderContent(config, template),
      config.objetSocial && {
        text: config.objetSocial,
        fontSize: fontSize.body,
        color: colors.secondary,
        margin: [0, 0, 0, 4],
      },
      {
        text: 'RAPPORT DES CHARGES',
        style: 'title',
        margin: [0, 0, 0, 8],
      },
    ];

    const isCategoryMode = categoryChargesData && categoryChargesData.categories.length > 0;

    if (isCategoryMode) {
      const { categories: catData, referencePeriod, totalByMonth } = categoryChargesData;
      content.push({
        text: `Période de référence : du ${fmtDate(referencePeriod.startDate)} au ${fmtDate(referencePeriod.endDate)}`,
        fontSize: fontSize.body,
        margin: [0, 0, 0, 12],
      });

      const monthKeys = Object.keys(totalByMonth).sort();
      const catsWithData = catData.filter((c) => c.total > 0);

      // Tableau transposé : Mois en lignes, Catégories en colonnes (optimise l'espace)
      const headerRow: any[] = [
        { text: 'Mois', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
        ...catsWithData.map((c) => ({ text: c.name, style: 'tableHeader', fillColor: colors.primary, color: '#ffffff', alignment: 'right' as const })),
        { text: 'Total', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff', alignment: 'right' as const },
      ];

      const tableBody: any[][] = [headerRow];
      let grandTotal = 0;

      for (const mk of monthKeys) {
        const monthLabel = `${mk.slice(5)}/${mk.slice(2, 4)}`;
        const rowTotal = totalByMonth[mk] ?? 0;
        grandTotal += rowTotal;
        const row: any[] = [
          { text: monthLabel, fontSize: fontSize.body },
          ...catsWithData.map((cat) => ({ text: formatCurrency(cat.monthlyAmounts[mk] ?? 0), alignment: 'right' as const, fontSize: fontSize.body })),
          { text: formatCurrency(rowTotal), alignment: 'right' as const, fontSize: fontSize.body },
        ];
        tableBody.push(row);
      }

      tableBody.push([
        { text: 'TOTAL', bold: true, fontSize: fontSize.body },
        ...catsWithData.map((cat) => ({ text: formatCurrency(cat.total), alignment: 'right' as const, bold: true })),
        { text: formatCurrency(grandTotal), alignment: 'right' as const, bold: true },
      ]);

      const widths: (string | number)[] = ['auto', ...catsWithData.map(() => 'auto'), 55];

      content.push({
        table: {
          headerRows: 1,
          widths,
          body: tableBody,
        },
        layout: buildAssociationTableLayout(template),
        margin: [0, 0, 0, 16],
      });
    } else {
      const flatSubs = ProjectionService.getAllFlatSubscriptions(project.subscriptions);
      const debitSubs = flatSubs.filter((s) => s.type === 'debit');

      content.push({
        text: `Période de projection : du ${fmtDate(project.projectionConfig.startDate)} au ${fmtDate(project.projectionConfig.endDate)}`,
        fontSize: fontSize.body,
        margin: [0, 0, 0, 12],
      });

      if (debitSubs.length === 0) {
        content.push({
          text: 'Aucune charge récurrente configurée.',
          italics: true,
          color: colors.secondary,
        });
      } else {
        const tableBody: any[][] = [
          [
            { text: 'Nom', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
            { text: 'Montant', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff', alignment: 'right' as const },
            { text: 'Périodicité', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
            { text: 'Date début', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
            { text: 'Date fin', style: 'tableHeader', fillColor: colors.primary, color: '#ffffff' },
          ],
        ];

        let totalCharges = 0;
        for (const sub of debitSubs) {
          const startD = sub.startDate instanceof Date ? sub.startDate : new Date(sub.startDate);
          const endD = sub.endDate ? (sub.endDate instanceof Date ? sub.endDate : new Date(sub.endDate)) : null;
          tableBody.push([
            { text: sub.name, fontSize: fontSize.body },
            { text: formatCurrency(sub.amount), alignment: 'right' as const },
            { text: PERIODICITY_LABELS[sub.periodicity] || sub.periodicity, fontSize: fontSize.body },
            { text: fmtDate(startD), fontSize: fontSize.body },
            { text: endD ? fmtDate(endD) : '—', fontSize: fontSize.body },
          ]);
          totalCharges += Math.abs(sub.amount);
        }

        tableBody.push([
          { text: 'Total charges (montants bruts)', colSpan: 4, bold: true },
          {},
          {},
          {},
          { text: formatCurrency(totalCharges), alignment: 'right' as const, bold: true },
        ]);

        content.push({
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto'],
            body: tableBody,
          },
          layout: buildAssociationTableLayout(template),
          margin: [0, 0, 0, 16],
        });
      }
    }

    const docDefinition: TDocumentDefinitions = {
      ...buildAssociationDocDefinition(content, template),
      content,
    } as TDocumentDefinitions;

    const pdfDoc = pdfMake.createPdf(docDefinition);
    const now = new Date();
    const fileName = `Charges_Association_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.pdf`;

    if (isElectronAvailable()) {
      const blob = await getPdfBlob(pdfDoc);
      const base64 = await blobToBase64(blob);
      const result = await window.electronAPI!.saveFile!({
        defaultPath: fileName,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (!result.success || !result.path) return;
      const writeResult = await window.electronAPI!.writeBinaryFile!(result.path, base64);
      if (!writeResult.success) {
        throw new Error(writeResult.error || 'Erreur sauvegarde PDF');
      }
    } else {
      pdfDoc.download(fileName);
    }
  }
}
