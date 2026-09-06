import i18n from '../i18n/config';
import pdfMake from 'pdfmake/build/pdfmake';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { AssociationConfig, Donation, Donateur, ModeVersement, NatureDon, ReceiptSignature } from '../types/association';
import { Adresse, Client, PDFTemplate } from '../types/invoice';
import { donateurDisplayName, formatMoney } from '../utils/invoiceFormat';
import { montantEnLettres } from '../utils/montantEnLettres';
import { withExampleAssociation } from '../constants/associationDemo';
import { AssociationConfigService } from './AssociationConfigService';
import { AttachmentService } from './AttachmentService';
import { EmetteurService } from './EmetteurService';
import { PDFTemplateService } from './PDFTemplateService';
import { RegistreRecusService } from './RegistreRecusService';
import { withLog } from './logger';
import { usablePdfImage } from '../utils/security';

let fontsLoaded = false;

type PdfDoc = ReturnType<typeof pdfMake.createPdf> & {
  getBlob?: (cb?: (blob: Blob) => void, err?: (e: unknown) => void) => unknown;
  getDataUrl?: (cb?: (url: string) => void, err?: (e: unknown) => void) => unknown;
};

function setPdfMakeVfs(vfs: unknown) {
  try {
    Object.defineProperty(pdfMake, 'vfs', { value: vfs, writable: true, configurable: true });
  } catch {
    (pdfMake as { vfs?: unknown }).vfs = vfs;
  }
}

async function loadFonts() {
  if (fontsLoaded) return;
  try {
    const pdfFonts = await import('pdfmake/build/vfs_fonts');
    const fonts = (pdfFonts as { default?: { pdfMake?: { vfs?: unknown }; vfs?: unknown } }).default;
    if (fonts?.pdfMake?.vfs) setPdfMakeVfs(fonts.pdfMake.vfs);
    else if (fonts?.vfs) setPdfMakeVfs(fonts.vfs);
  } catch {
    /* vfs optionnel */
  }
  fontsLoaded = true;
}

async function callPdfMethod<T>(pdf: PdfDoc, method: 'getBlob' | 'getDataUrl'): Promise<T> {
  const fn = pdf[method];
  if (typeof fn !== 'function') throw new Error(`pdfmake : ${method} indisponible`);
  const result = Reflect.apply(fn, pdf, []);
  if (result != null && typeof (result as Promise<T>).then === 'function') {
    return result as Promise<T>;
  }
  return new Promise<T>((resolve, reject) => {
    Reflect.apply(fn, pdf, [resolve, reject]);
  });
}

async function getBuffer(doc: TDocumentDefinitions): Promise<Uint8Array> {
  await loadFonts();
  const pdf = pdfMake.createPdf(doc) as PdfDoc;
  const blob = await callPdfMethod<Blob>(pdf, 'getBlob');
  return new Uint8Array(await blob.arrayBuffer());
}

async function getDataUrl(doc: TDocumentDefinitions): Promise<string> {
  await loadFonts();
  const pdf = pdfMake.createPdf(doc) as PdfDoc;
  return callPdfMethod<string>(pdf, 'getDataUrl');
}

export const NATURE_LABEL: Record<NatureDon, string> = {
  numeraire: 'Don en numéraire',
  nature: 'Don en nature',
  mecenat_competences: 'Mécénat de compétences',
};

export const MODE_LABEL: Record<ModeVersement, string> = {
  virement: 'Virement bancaire',
  cheque: 'Chèque',
  especes: 'Espèces',
  cb: 'Carte bancaire',
  prelevement: 'Prélèvement',
  autre: 'Autre',
};

function formatAdresse(adresse?: Adresse | null): string {
  if (!adresse) return '';
  return [adresse.rue, `${adresse.codePostal ?? ''} ${adresse.ville ?? ''}`.trim(), adresse.pays]
    .filter(Boolean)
    .join(', ');
}

function templateColors(template?: PDFTemplate) {
  return {
    primary: template?.colors.primary ?? '#1e3a8a',
    secondary: template?.colors.secondary ?? '#475569',
    text: template?.colors.text ?? '#1f2937',
    border: template?.colors.border ?? '#e5e7eb',
  };
}

function templateFontSize(template?: PDFTemplate) {
  return {
    title: template?.typography.fontSize.title ?? 18,
    header: template?.typography.fontSize.header ?? 14,
    body: template?.typography.fontSize.body ?? 10,
    footer: template?.typography.fontSize.footer ?? 8,
  };
}

async function resolveTemplate(templateId?: string): Promise<PDFTemplate | undefined> {
  if (templateId) {
    const template = await PDFTemplateService.getTemplateById(templateId);
    if (template) return template;
  }
  const templates = await PDFTemplateService.loadTemplates();
  return templates.find((item) => item.isDefault) || templates[0];
}

function requireProductionAssociation(config: AssociationConfig): AssociationConfig {
  if (!config.denominationSociale?.trim()) {
    throw new Error(i18n.t('errors.associationConfigIncomplete'));
  }
  return config;
}

async function resolveLogo(config: AssociationConfig): Promise<string | undefined> {
  const fromConfig = usablePdfImage(config.logo);
  if (fromConfig) return fromConfig;
  const emetteur = await EmetteurService.loadEmetteurExtended();
  return usablePdfImage(emetteur?.logo);
}

function buildHeader(config: AssociationConfig, template?: PDFTemplate, logo?: string): Content[] {
  const colors = templateColors(template);
  const fontSize = templateFontSize(template);
  const lines = [
    config.formeJuridique,
    formatAdresse(config.adresse),
    config.rna ? `RNA : ${config.rna}` : '',
    config.siren ? `SIREN : ${config.siren}` : '',
    config.siret ? `SIRET : ${config.siret}` : '',
    config.email,
    config.telephone,
  ].filter(Boolean);

  const textStack: Content[] = [
    {
      text: config.denominationSociale || 'Association',
      fontSize: fontSize.title,
      bold: true,
      color: colors.primary,
    },
    ...lines.map((line) => ({
      text: line as string,
      color: colors.secondary,
      fontSize: fontSize.footer + 1,
    })),
  ];

  if (!logo) return [{ stack: textStack, margin: [0, 0, 0, 12] }];

  const logoWidth = template?.layout.logoSize.width ?? 120;
  const position = template?.layout.logoPosition ?? 'left';
  if (position === 'center') {
    return [
      { image: logo, width: logoWidth, alignment: 'center', margin: [0, 0, 0, 8] },
      { stack: textStack, alignment: 'center', margin: [0, 0, 0, 12] },
    ];
  }
  return [
    {
      columns:
        position === 'right'
          ? [{ stack: textStack, width: '*' }, { image: logo, width: logoWidth, alignment: 'right' }]
          : [{ image: logo, width: logoWidth }, { stack: textStack, width: '*', alignment: 'right' }],
      columnGap: 16,
      margin: [0, 0, 0, 12],
    },
  ];
}

function tableLayout(template?: PDFTemplate) {
  const border = templateColors(template).border;
  const primary = templateColors(template).primary;
  return {
    hLineWidth: (index: number, node: { table: { body: unknown[] } }) =>
      index === 0 || index === 1 || index === node.table.body.length ? 0.75 : 0.25,
    vLineWidth: () => 0.35,
    hLineColor: () => border,
    vLineColor: () => border,
    fillColor: (rowIndex: number) => {
      if (rowIndex === 0) return primary;
      return rowIndex % 2 === 1 ? '#f8fafc' : null;
    },
    paddingLeft: () => 7,
    paddingRight: () => 7,
    paddingTop: () => 5,
    paddingBottom: () => 5,
  };
}

function styledDoc(
  content: Content[],
  template: PDFTemplate | undefined,
  title: string
): TDocumentDefinitions {
  const colors = templateColors(template);
  const fontSize = templateFontSize(template);
  return {
    pageSize: template?.format === 'Letter' ? 'LETTER' : 'A4',
    pageOrientation: template?.orientation ?? 'portrait',
    pageMargins: template
      ? [
          template.layout.margins.left,
          template.layout.margins.top,
          template.layout.margins.right,
          template.layout.margins.bottom,
        ]
      : [40, 40, 40, 40],
    content,
    styles: {
      title: { fontSize: fontSize.header + 2, bold: true, color: colors.primary, margin: [0, 4, 0, 8] },
      subheader: { fontSize: fontSize.header, bold: true, color: colors.primary, margin: [0, 10, 0, 4] },
      tableHeader: { fontSize: fontSize.body, bold: true, color: '#ffffff' },
      mentions: { fontSize: fontSize.footer, color: colors.secondary },
    },
    defaultStyle: { fontSize: fontSize.body, color: colors.text },
    info: { title },
    footer: (current, pages) => ({
      text: `${title} · page ${current}/${pages}`,
      alignment: 'center',
      fontSize: fontSize.footer,
      color: '#94a3b8',
      margin: [0, 8, 0, 0],
    }),
  };
}

export interface RecuFiscalLine {
  date: string;
  description?: string;
  montant: number;
  natureDon?: NatureDon;
  modeVersement?: ModeVersement;
  valuationMethod?: string;
}

export interface RecuFiscalParams {
  donateur: Donateur;
  montant: number;
  date: string;
  donationId?: string;
  donationIds?: string[];
  description?: string;
  valuationMethod?: string;
  valuationProvidedByDonor?: boolean;
  natureDon?: NatureDon;
  modeVersement?: ModeVersement;
  periodStart?: string;
  periodEnd?: string;
  lines?: RecuFiscalLine[];
  signature?: ReceiptSignature | null;
}

function buildMentions(
  config: AssociationConfig,
  donateur: Donateur,
  numero: string,
  template?: PDFTemplate,
  signature?: ReceiptSignature | null
): Content[] {
  const colors = templateColors(template);
  const fontSize = templateFontSize(template);
  const isEntreprise = donateur.type === 'entreprise';
  const articleCGI = isEntreprise
    ? 'article 238 bis du code général des impôts'
    : 'article 200 du code général des impôts';
  const cerfa = isEntreprise ? 'Cerfa n° 16216 (2041-MEC-SD)' : 'Cerfa n° 11580*05 (2041-RD)';
  const items: Content[] = [
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: colors.border }],
      margin: [0, 14, 0, 8],
    },
    {
      text: `Reçu n° ${numero} — Émis le ${new Date().toLocaleDateString('fr-FR')} — ${cerfa}`,
      style: 'mentions',
      bold: true,
      margin: [0, 0, 0, 4],
    },
    {
      text: `Le bénéficiaire certifie sur l’honneur que les dons et versements reçus ouvrent droit à la réduction d’impôt prévue à l’${articleCGI}.`,
      style: 'mentions',
      margin: [0, 0, 0, 2],
    },
    {
      text: 'Attestation : les dons listés sur ce document n’ont donné lieu à aucune contrepartie directe ou indirecte (bien, service, avantage…) au profit du donateur.',
      style: 'mentions',
      margin: [0, 0, 0, 2],
    },
  ];
  if (config.statutOIG) {
    const joMention = config.datePublicationJO
      ? ` (Journal officiel du ${new Date(config.datePublicationJO).toLocaleDateString('fr-FR')})`
      : '';
    items.push({
      text: `Organisme d’intérêt général au sens des articles 200 et 238 bis du CGI${joMention}.`,
      style: 'mentions',
      margin: [0, 0, 0, 2],
    });
  }
  if (config.referencesCGI) {
    items.push({ text: config.referencesCGI, style: 'mentions', margin: [0, 0, 0, 6] });
  }
  const signedAt = signature?.signedAt ? new Date(signature.signedAt) : null;
  const signedLabel = signedAt && !Number.isNaN(signedAt.getTime())
    ? ` le ${signedAt.toLocaleDateString('fr-FR')} à ${signedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : '';
  const signatureImage = usablePdfImage(signature?.imageDataUrl);
  const signatureStack: Content[] = [
    { text: config.signataireQualite || 'Le représentant légal', fontSize: fontSize.footer, color: colors.secondary },
    { text: config.signataireNom || '________________________', fontSize: fontSize.body, bold: true, margin: [0, 2, 0, 4] },
  ];
  if (signatureImage) {
    signatureStack.push({ image: signatureImage, width: 140, alignment: 'center', margin: [0, 0, 0, 2] });
    signatureStack.push({
      text: `Signature électronique du représentant légal${signedLabel}.`,
      fontSize: fontSize.footer - 1,
      color: colors.secondary,
      italics: true,
    });
    signatureStack.push({
      text: 'Cette signature électronique a la même force probante qu’une signature manuscrite (articles 1366 et 1367 du Code civil).',
      fontSize: Math.max(6, fontSize.footer - 1),
      color: colors.secondary,
      italics: true,
      margin: [0, 2, 0, 0],
    });
  } else {
    signatureStack.push({ text: '\n\n_________________________', fontSize: fontSize.footer, color: colors.secondary });
    signatureStack.push({ text: 'Signature et cachet', fontSize: fontSize.footer - 1, color: colors.secondary, italics: true });
  }
  items.push({
    columns: [
      { width: '*', text: '' },
      {
        width: 'auto',
        stack: signatureStack,
        alignment: 'center',
        margin: [0, 8, 0, 0],
      },
    ],
  });
  items.push({
    text: 'Vos données personnelles sont traitées conformément au RGPD (Règlement UE 2016/679) et à la loi Informatique et Libertés. Vous disposez d’un droit d’accès et de rectification en contactant l’association. Le droit d’effacement est limité par l’obligation légale de conservation des reçus fiscaux et pièces justificatives (en pratique 10 ans). Ce document ne constitue pas une attestation d’éligibilité de l’organisme.',
    fontSize: Math.max(6, fontSize.footer - 1),
    color: '#9ca3af',
    italics: true,
    margin: [0, 10, 0, 0],
  });
  return items;
}

async function buildRecuDoc(
  config: AssociationConfig,
  params: RecuFiscalParams,
  numero: string,
  template?: PDFTemplate
): Promise<TDocumentDefinitions> {
  const colors = templateColors(template);
  const fontSize = templateFontSize(template);
  const logo = await resolveLogo(config);
  const d = params.donateur;
  const isEntreprise = d.type === 'entreprise';
  const lines: RecuFiscalLine[] = params.lines?.length
    ? params.lines
    : [{
      date: params.date,
      description: params.description,
      montant: params.montant,
      natureDon: params.natureDon,
      modeVersement: params.modeVersement,
      valuationMethod: params.valuationMethod,
    }];
  const isRecap = Boolean(params.periodStart && params.periodEnd) || lines.length > 1;
  const natures = [...new Set(lines.map((line) => line.natureDon ?? 'numeraire'))];
  const nature = params.natureDon ?? (natures.length === 1 ? natures[0] : undefined);
  const natureLabel = nature
    ? NATURE_LABEL[nature]
    : natures.map((item) => NATURE_LABEL[item]).join(', ');
  const articleCGILabel = isEntreprise
    ? 'Don ouvrant droit à réduction IS (art. 238 bis CGI)'
    : 'Don ouvrant droit à réduction IR (art. 200 CGI)';
  const dateLabel = new Date(params.date).toLocaleDateString('fr-FR');
  const periodLabel = params.periodStart && params.periodEnd
    ? `du ${new Date(params.periodStart).toLocaleDateString('fr-FR')} au ${new Date(params.periodEnd).toLocaleDateString('fr-FR')}`
    : dateLabel;
  const donorLines = [
    donateurDisplayName(d),
    formatAdresse(d.adresse),
    d.siren ? `SIREN : ${d.siren}` : '',
    d.siret ? `SIRET : ${d.siret}` : '',
    d.email,
  ].filter(Boolean);

  const content: Content[] = [
    ...buildHeader(config, template, logo),
  ];
  if (config.objetSocial) {
    content.push({
      text: config.objetSocial,
      fontSize: fontSize.body,
      color: colors.secondary,
      margin: [0, 0, 0, 8],
    });
  }

  const donStack: Content[] = [
    { text: isRecap ? 'DONS DE LA PÉRIODE' : 'DON', fontSize: fontSize.footer, bold: true, color: colors.secondary },
    {
      text: isRecap ? `Période : ${periodLabel}` : `Date de perception : ${dateLabel}`,
      margin: [0, 3, 0, 0],
    },
  ];
  if (isRecap) donStack.push({ text: `Nombre de versements : ${lines.length}` });
  donStack.push({ text: `Nature : ${natureLabel}` });
  if (!isRecap && params.modeVersement) {
    donStack.push({ text: `Mode de versement : ${MODE_LABEL[params.modeVersement]}` });
  }

  const tableHeader = isRecap
    ? [
      { text: 'Date', style: 'tableHeader' },
      { text: 'Nature', style: 'tableHeader' },
      { text: 'Description', style: 'tableHeader' },
      { text: 'Montant', style: 'tableHeader', alignment: 'right' },
    ]
    : [
      { text: 'Date', style: 'tableHeader' },
      { text: 'Description', style: 'tableHeader' },
      { text: 'Montant', style: 'tableHeader', alignment: 'right' },
    ];
  const tableRows = lines.map((line) => {
    const lineNature = line.natureDon ?? 'numeraire';
    const description = [
      line.description || NATURE_LABEL[lineNature],
      lineNature !== 'numeraire' && line.valuationMethod ? `Valorisation : ${line.valuationMethod}` : '',
    ].filter(Boolean).join('\n');
    if (isRecap) {
      return [
        new Date(line.date).toLocaleDateString('fr-FR'),
        NATURE_LABEL[lineNature],
        description,
        { text: formatMoney(line.montant), alignment: 'right' as const, bold: true },
      ];
    }
    return [
      new Date(line.date).toLocaleDateString('fr-FR'),
      description,
      { text: formatMoney(line.montant), alignment: 'right' as const, bold: true },
    ];
  });
  const totalRow = isRecap
    ? [
      { text: 'TOTAL', colSpan: 3, bold: true },
      {},
      {},
      { text: formatMoney(params.montant), alignment: 'right', bold: true },
    ]
    : [
      { text: 'TOTAL', colSpan: 2, bold: true },
      {},
      { text: formatMoney(params.montant), alignment: 'right', bold: true },
    ];

  content.push(
    {
      columns: [
        {
          text: isEntreprise ? 'REÇU DE MÉCÉNAT' : 'REÇU AU TITRE DES DONS',
          style: 'title',
          width: '*',
        },
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
                { text: 'BÉNÉFICIAIRE DU DON', fontSize: fontSize.footer, bold: true, color: colors.secondary },
                { text: donorLines.join('\n'), fontSize: fontSize.body, margin: [0, 3, 0, 0] },
              ],
              fillColor: '#f8fafc',
              margin: [8, 8, 8, 8],
            },
            {
              stack: donStack,
              fillColor: '#f8fafc',
              margin: [8, 8, 8, 8],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => colors.border,
        vLineColor: () => colors.border,
      },
      margin: [0, 4, 0, 12],
    },
    {
      table: {
        headerRows: 1,
        widths: isRecap ? ['auto', 'auto', '*', 'auto'] : ['auto', '*', 'auto'],
        body: [tableHeader, ...tableRows, totalRow] as TableCell[][],
      },
      layout: tableLayout(template),
    },
    {
      text: `Montant en lettres : ${montantEnLettres(params.montant)}`,
      italics: true,
      margin: [0, 8, 0, 4],
    }
  );
  if (params.valuationProvidedByDonor) {
    content.push({
      text: 'Valorisation communiquée sous la responsabilité du donateur.',
      fontSize: fontSize.footer,
      italics: true,
      color: colors.secondary,
    });
  }
  content.push(...buildMentions(config, d, numero, template, params.signature));
  return styledDoc(content, template, numero);
}

function contactToDonateur(contact: Client): Donateur {
  return {
    id: contact.id,
    type: contact.type,
    civilite: contact.civilite,
    nom: contact.nom,
    prenom: contact.prenom,
    denominationSociale: contact.denominationSociale,
    formeJuridique: contact.formeJuridique,
    siren: contact.siren,
    siret: contact.siret,
    adresse: contact.adresseFacturation,
    email: contact.email,
    telephone: contact.telephone,
    notes: contact.notes,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  };
}

const SAMPLE_DONATEUR: Donateur = {
  id: 'preview',
  type: 'particulier',
  civilite: 'M.',
  nom: 'Dupont',
  prenom: 'Jean',
  adresse: { rue: '12 rue des Lilas', codePostal: '75011', ville: 'Paris', pays: 'France' },
  email: 'jean.dupont@email.fr',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const AssociationPDFService = {
  async generateRecuFiscal(
    params: RecuFiscalParams,
    options?: { open?: boolean; signature?: ReceiptSignature | null }
  ): Promise<{ path: string; numero: string; receiptId: string }> {
    return withLog('AssociationPDFService.generateRecuFiscal', async () => {
      if (params.donateur.id === 'ANONYME' || !params.donateur.id) {
        throw new Error(i18n.t('errors.noIdentifiedDonor'));
      }
      const config = requireProductionAssociation(await AssociationConfigService.getOrCreateConfig());
      const numero = await RegistreRecusService.generateNextNumero();
      const template = await resolveTemplate(config.pdfTemplateRecuFiscal);
      const bytes = await getBuffer(await buildRecuDoc(config, { ...params, signature: options?.signature ?? params.signature }, numero, template));
      const saved = await AttachmentService.savePdfBytes(`${numero}.pdf`, bytes);
      const receipt = await RegistreRecusService.addEntry({
        numero,
        donationId: params.donationId ?? params.donationIds?.[0],
        donationIds: params.donationIds,
        donateurId: params.donateur.id,
        donateurLabel: donateurDisplayName(params.donateur),
        montant: params.montant,
        date: params.date,
        dateEmission: new Date().toISOString().slice(0, 10),
        natureDon: params.natureDon,
        modeVersement: params.modeVersement,
        pdfPath: saved.rel,
      });
      if (options?.open !== false) await AttachmentService.openRel(saved.rel);
      return { path: saved.rel, numero, receiptId: receipt.id };
    });
  },

  async generateForDonation(
    donation: Donation,
    contact: Client,
    options?: { open?: boolean; signature?: ReceiptSignature | null }
  ): Promise<{ path: string; numero: string; receiptId: string }> {
    return withLog('AssociationPDFService.generateForDonation', async () => {
      if (donation.anonymous) throw new Error(i18n.t('errors.noIdentifiedDonor'));
      if (!donation.receiptEligible) throw new Error(i18n.t('errors.donationNotEligible'));
      if (donation.receiptId) throw new Error(i18n.t('errors.receiptAlreadyIssued'));
      return this.generateRecuFiscal({
        donateur: contactToDonateur(contact),
        donationId: donation.id,
        donationIds: [donation.id],
        montant: donation.montant,
        date: donation.datePerception || donation.date,
        description: donation.description,
        valuationMethod: donation.valuationMethod,
        valuationProvidedByDonor: donation.valuationProvidedByDonor,
        natureDon: donation.natureDon,
        modeVersement: donation.modeVersement,
      }, options);
    });
  },

  async generateForDonorPeriod(
    contact: Client,
    donations: Donation[],
    period: { start: string; end: string },
    options?: { open?: boolean; signature?: ReceiptSignature | null }
  ): Promise<{ path: string; numero: string; receiptId: string; count: number; total: number; donationIds: string[] }> {
    return withLog('AssociationPDFService.generateForDonorPeriod', async () => {
      const eligible = donations
        .filter((donation) =>
          donation.contactId === contact.id
          && !donation.anonymous
          && donation.receiptEligible
          && !donation.receiptId
        )
        .sort((a, b) => (a.datePerception || a.date).localeCompare(b.datePerception || b.date));
      if (eligible.length === 0) {
        throw new Error(i18n.t('errors.noEligibleDonorPeriod'));
      }
      const natures = new Set(eligible.map((donation) => donation.natureDon));
      const total = eligible.reduce((sum, donation) => sum + donation.montant, 0);
      const result = await this.generateRecuFiscal({
        donateur: contactToDonateur(contact),
        donationId: eligible[0].id,
        donationIds: eligible.map((donation) => donation.id),
        montant: total,
        date: period.end,
        periodStart: period.start,
        periodEnd: period.end,
        natureDon: natures.size === 1 ? eligible[0].natureDon : undefined,
        valuationProvidedByDonor: eligible.some((donation) => donation.valuationProvidedByDonor),
        lines: eligible.map((donation) => ({
          date: donation.datePerception || donation.date,
          description: donation.description,
          montant: donation.montant,
          natureDon: donation.natureDon,
          modeVersement: donation.modeVersement,
          valuationMethod: donation.valuationMethod,
        })),
      }, options);
      return { ...result, count: eligible.length, total, donationIds: eligible.map((donation) => donation.id) };
    });
  },

  async generateForDonations(
    items: Array<{ donation: Donation; contact: Client }>,
    options?: { signature?: ReceiptSignature | null }
  ): Promise<Array<{ path: string; numero: string; receiptId: string; donationId: string }>> {
    return withLog('AssociationPDFService.generateForDonations', async () => {
      if (items.length === 0) throw new Error(i18n.t('errors.noDonationSelected'));
      const results: Array<{ path: string; numero: string; receiptId: string; donationId: string }> = [];
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        const generated = await this.generateForDonation(item.donation, item.contact, {
          open: index === items.length - 1,
          signature: options?.signature,
        });
        results.push({ ...generated, donationId: item.donation.id });
      }
      return results;
    }, { data: { count: items.length } });
  },

  async regeneratePdf(
    receiptId: string,
    donation: Donation,
    contact: Client
  ): Promise<string> {
    return withLog('AssociationPDFService.regeneratePdf', async () => {
      const entry = await RegistreRecusService.getById(receiptId);
      if (!entry) throw new Error(i18n.t('errors.receiptNotFound'));
      if (entry.annule) throw new Error(i18n.t('errors.cancelledReceiptNoRegen'));
      const config = requireProductionAssociation(await AssociationConfigService.getOrCreateConfig());
      const template = await resolveTemplate(config.pdfTemplateRecuFiscal);
      const bytes = await getBuffer(await buildRecuDoc(config, {
        donateur: contactToDonateur(contact),
        donationId: donation.id,
        montant: donation.montant,
        date: donation.datePerception || donation.date,
        description: donation.description,
        valuationMethod: donation.valuationMethod,
        valuationProvidedByDonor: donation.valuationProvidedByDonor,
        natureDon: donation.natureDon,
        modeVersement: donation.modeVersement,
      }, entry.numero, template));
      const saved = await AttachmentService.savePdfBytes(`${entry.numero}.pdf`, bytes);
      await RegistreRecusService.updatePdfPath(entry.id, saved.rel);
      await AttachmentService.openRel(saved.rel);
      return saved.rel;
    });
  },

  async generatePreviewDataUrl(template?: PDFTemplate): Promise<string> {
    return withLog('AssociationPDFService.generatePreviewDataUrl', async () => {
      const config = withExampleAssociation(await AssociationConfigService.getOrCreateConfig());
      const resolved = template ?? await resolveTemplate(config.pdfTemplateRecuFiscal);
      const doc = await buildRecuDoc(config, {
        donateur: SAMPLE_DONATEUR,
        montant: 150,
        date: new Date().toISOString().slice(0, 10),
        description: 'Don exemple pour aperçu du modèle',
        natureDon: 'numeraire',
        modeVersement: 'virement',
      }, 'RECU-APERCU-0001', resolved);
      return getDataUrl(doc);
    });
  },
};
