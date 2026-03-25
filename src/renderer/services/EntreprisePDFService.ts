import pdfMake from 'pdfmake/build/pdfmake';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { Emetteur, Facture } from '../types/Invoice';
import { Subscription, FiscalCategory, Project, CategoryChargesData } from '../types/ProjectManagement';
import { AchatRegistreEntry } from '../types/Stock';
import { ProjectionService } from './ProjectionService';
import { EmetteurService } from './EmetteurService';

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

const PRIMARY = '#1e3a8a';
const SECONDARY = '#475569';
const TEXT_COLOR = '#1f2937';
const BORDER_COLOR = '#e5e7eb';

const fmt = (v: number) => `${v.toFixed(2).replace('.', ',')} €`;

const fmtDate = (d: Date) =>
  d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const REGIME_LABELS: Record<string, string> = {
  micro_bic: 'Micro-BIC',
  micro_bnc: 'Micro-BNC',
  reel_simplifie: 'Réel simplifié',
  reel_normal: 'Réel normal',
  is: 'Impôt sur les sociétés (IS)',
};

const TVA_REGIME_LABELS: Record<string, string> = {
  franchise: 'Franchise en base de TVA',
  reel_simplifie: 'Réel simplifié',
  reel_normal: 'Réel normal',
  mini_reel: 'Mini-réel',
};

const PERIODICITY_LABELS: Record<string, string> = {
  daily: 'Quotidien',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  yearly: 'Annuel',
  unique: 'Unique',
};

const FISCAL_CAT_LABELS: Record<FiscalCategory, string> = {
  LOYER: 'Loyers et charges locatives',
  SALAIRES: 'Salaires et charges sociales',
  ACHATS: 'Achats de marchandises/matières',
  HONORAIRES: 'Honoraires (sous-traitance, comptable…)',
  VEHICULE: 'Frais de véhicule',
  DEPLACEMENT: 'Frais de déplacement et réception',
  FOURNITURES: 'Petit matériel et fournitures',
  ASSURANCES: "Primes d'assurance",
  TELECOM: 'Téléphone, internet, abonnements',
  AUTRES: 'Autres charges',
};

const buildEmetteurHeader = (emetteur: Emetteur): any[] => {
  const textStack = [
    { text: emetteur.denominationSociale, fontSize: 16, bold: true, color: PRIMARY },
    { text: `${emetteur.adresse.rue}, ${emetteur.adresse.codePostal} ${emetteur.adresse.ville}`, color: SECONDARY, fontSize: 9 },
    { text: `SIRET : ${emetteur.siret}`, color: SECONDARY, fontSize: 9 },
    { text: `TVA : ${emetteur.numeroTVA || 'Non assujetti'}`, color: SECONDARY, fontSize: 9 },
  ];

  if (emetteur.regimeFiscal) {
    textStack.push({ text: `Régime fiscal : ${REGIME_LABELS[emetteur.regimeFiscal] || emetteur.regimeFiscal}`, color: SECONDARY, fontSize: 9 });
  }
  textStack.push({ text: `Régime TVA : ${TVA_REGIME_LABELS[emetteur.regimeTVA] || emetteur.regimeTVA}`, color: SECONDARY, fontSize: 9 });

  if (emetteur.logo) {
    return [
      {
        columns: [
          { image: emetteur.logo, width: 100 },
          { stack: textStack, alignment: 'right' },
        ],
        columnGap: 12,
      },
      { text: '\n' },
    ];
  }

  return [...textStack, { text: '\n' }];
};

const baseDocDef = (content: any[]): TDocumentDefinitions => ({
  pageSize: 'A4',
  pageOrientation: 'portrait',
  pageMargins: [40, 40, 40, 50],
  content,
  footer: (currentPage: number, pageCount: number) => ({
    text: `Page ${currentPage} / ${pageCount} — Généré le ${fmtDate(new Date())}`,
    alignment: 'center',
    fontSize: 7,
    color: SECONDARY,
    margin: [40, 10, 40, 0],
  }),
  styles: {
    header: { fontSize: 16, bold: true, color: PRIMARY },
    title: { fontSize: 14, bold: true, margin: [0, 10, 0, 8], color: PRIMARY },
    subheader: { fontSize: 12, bold: true, margin: [0, 8, 0, 4], color: PRIMARY },
    total: { fontSize: 12, bold: true, color: PRIMARY },
    mentions: { fontSize: 8, color: SECONDARY },
    tableHeader: { fontSize: 9, bold: true },
  },
  defaultStyle: {
    fontSize: 9,
    color: TEXT_COLOR,
  },
} as any);

const tableLayout = () => ({
  hLineWidth: (i: number, node: any) =>
    i === 0 || i === 1 || i === node.table.body.length ? 0.75 : 0.25,
  vLineWidth: () => 0.25,
  hLineColor: () => BORDER_COLOR,
  vLineColor: () => BORDER_COLOR,
  fillColor: (rowIndex: number) => {
    if (rowIndex === 0) return PRIMARY;
    return rowIndex % 2 === 1 ? '#f8fafc' : null;
  },
});

const thCell = (text: string, opts?: any) => ({
  text,
  style: 'tableHeader',
  fillColor: PRIMARY,
  color: '#ffffff',
  ...opts,
});

const isElectronAvailable = () =>
  typeof window !== 'undefined'
  && typeof window.electronAPI?.saveFile === 'function'
  && typeof window.electronAPI?.writeBinaryFile === 'function';

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') { reject(new Error('Format invalide')); return; }
      const base64 = result.split(',')[1];
      if (!base64) { reject(new Error('Conversion base64 échouée')); return; }
      resolve(base64);
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

const saveOrDownloadPdf = async (docDefinition: TDocumentDefinitions, defaultFileName: string) => {
  const pdfDoc = pdfMake.createPdf(docDefinition);
  if (isElectronAvailable()) {
    const blob = await getPdfBlob(pdfDoc);
    const base64 = await blobToBase64(blob);
    const result = await window.electronAPI.saveFile({
      defaultPath: defaultFileName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (!result.success || !result.path) return;
    const writeResult = await window.electronAPI.writeBinaryFile(result.path, base64);
    if (!writeResult.success) {
      throw new Error(writeResult.error || 'Erreur lors de la sauvegarde du PDF');
    }
    return;
  }
  pdfDoc.download(defaultFileName);
};

function getMonthlyEquivalent(amount: number, periodicity: string): number {
  switch (periodicity) {
    case 'daily': return amount * 30;
    case 'weekly': return amount * 4.33;
    case 'monthly': return amount;
    case 'quarterly': return amount / 3;
    case 'yearly': return amount / 12;
    case 'unique': return 0;
    default: return amount;
  }
}

// ========== Interfaces de données ==========

export interface RecetteEntry {
  date: Date;
  nature: string;
  clientName: string;
  factureNumero: string;
  montantHT: number;
  tva: number;
  montantTTC: number;
  modePaiement: string;
  reference: string;
}

export interface TVAReportData {
  periods: Record<string, { collected: number; deductible: number }>;
  totalCollected: number;
  totalDeductible: number;
  tvaToPay: number;
}

type TVAPeriodMode = 'monthly' | 'quarterly' | 'yearly';

// ========== SERVICE ==========

export class EntreprisePDFService {

  // ----- 1. LIVRE DES RECETTES -----
  static async generateLivreRecettesPDF(
    entries: RecetteEntry[],
    year: number,
    emetteur: Emetteur
  ): Promise<void> {
    await loadFonts();

    const totalHT = entries.reduce((s, r) => s + r.montantHT, 0);
    const totalTVA = entries.reduce((s, r) => s + r.tva, 0);
    const totalTTC = entries.reduce((s, r) => s + r.montantTTC, 0);

    const content: any[] = [
      ...buildEmetteurHeader(emetteur),
      { text: `LIVRE DES RECETTES — ${year}`, style: 'title' },
      {
        text: 'Registre chronologique des recettes encaissées, conformément aux obligations des articles 50-0 et 102 ter du Code Général des Impôts.',
        style: 'mentions',
        margin: [0, 0, 0, 12],
      },
      {
        table: {
          headerRows: 1,
          widths: [22, 52, '*', 80, 55, 45, 55, 60, 65],
          body: [
            [
              thCell('N°', { alignment: 'center' }),
              thCell('Date'),
              thCell('Nature'),
              thCell('Client'),
              thCell('HT', { alignment: 'right' }),
              thCell('TVA', { alignment: 'right' }),
              thCell('TTC', { alignment: 'right' }),
              thCell('Mode'),
              thCell('Référence'),
            ],
            ...entries.map((r, i) => [
              { text: `${i + 1}`, alignment: 'center' },
              { text: fmtDate(r.date) },
              { text: r.nature },
              { text: r.clientName },
              { text: fmt(r.montantHT), alignment: 'right' },
              { text: fmt(r.tva), alignment: 'right' },
              { text: fmt(r.montantTTC), alignment: 'right' },
              { text: r.modePaiement },
              { text: r.reference },
            ]),
          ],
        },
        layout: tableLayout(),
      },
      { text: '\n' },
      {
        columns: [
          { text: '', width: '*' },
          {
            width: 'auto',
            table: {
              body: [
                [{ text: 'Total HT', bold: true }, { text: fmt(totalHT), alignment: 'right', bold: true }],
                [{ text: 'Total TVA', bold: true }, { text: fmt(totalTVA), alignment: 'right', bold: true }],
                [{ text: 'Total TTC', bold: true, color: PRIMARY }, { text: fmt(totalTTC), alignment: 'right', bold: true, color: PRIMARY }],
              ],
            },
            layout: 'noBorders',
          },
        ],
      },
      { text: '\n\n' },
      {
        text: `Ce document a été généré automatiquement le ${fmtDate(new Date())}. Il ne se substitue pas aux déclarations fiscales obligatoires.`,
        style: 'mentions',
      },
    ];

    await saveOrDownloadPdf(baseDocDef(content), `Livre_Recettes_${year}.pdf`);
  }

  // ----- 2. RAPPORT TVA (CA3 / CA12) -----
  static async generateTVAReportPDF(
    data: TVAReportData,
    year: number,
    periodMode: TVAPeriodMode,
    emetteur: Emetteur
  ): Promise<void> {
    await loadFonts();

    const periodLabel = periodMode === 'monthly' ? 'Mensuel (CA3)'
      : periodMode === 'quarterly' ? 'Trimestriel (CA3)' : 'Annuel (CA12)';

    const sortedKeys = Object.keys(data.periods).sort();

    const content: any[] = [
      ...buildEmetteurHeader(emetteur),
      { text: `RAPPORT TVA — ${year}`, style: 'title' },
      { text: `Périodicité : ${periodLabel}`, fontSize: 10, margin: [0, 0, 0, 4] },
      { text: `Régime TVA : ${TVA_REGIME_LABELS[emetteur.regimeTVA] || emetteur.regimeTVA}`, fontSize: 10, margin: [0, 0, 0, 12] },

      { text: 'Synthèse des opérations', style: 'subheader' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 80, 80, 80],
          body: [
            [
              thCell('Période'),
              thCell('TVA collectée', { alignment: 'right' }),
              thCell('TVA déductible', { alignment: 'right' }),
              thCell('Solde', { alignment: 'right' }),
            ],
            ...sortedKeys.map(key => {
              const p = data.periods[key];
              const net = p.collected - p.deductible;
              return [
                { text: key },
                { text: fmt(p.collected), alignment: 'right' },
                { text: fmt(p.deductible), alignment: 'right' },
                { text: fmt(Math.abs(net)), alignment: 'right', color: net >= 0 ? '#dc2626' : '#16a34a' },
              ];
            }),
          ],
        },
        layout: tableLayout(),
      },
      { text: '\n' },

      { text: 'Correspondance formulaire CERFA (aide au remplissage)', style: 'subheader' },
      {
        table: {
          widths: [60, '*', 80],
          body: [
            [thCell('Ligne'), thCell('Libellé'), thCell('Montant', { alignment: 'right' })],
            [{ text: '01' }, { text: 'Ventes, prestations de services — base HT' }, { text: fmt(data.totalCollected > 0 ? data.totalCollected * 5 : 0), alignment: 'right' }],
            [{ text: '08' }, { text: 'TVA brute due (total TVA collectée)' }, { text: fmt(data.totalCollected), alignment: 'right' }],
            [{ text: '20' }, { text: 'TVA déductible sur immobilisations' }, { text: '—', alignment: 'right' }],
            [{ text: '21' }, { text: 'TVA déductible sur autres biens et services' }, { text: fmt(data.totalDeductible), alignment: 'right' }],
            [{ text: '28' }, { text: 'Total TVA déductible' }, { text: fmt(data.totalDeductible), alignment: 'right' }],
            [
              { text: data.tvaToPay >= 0 ? '30' : '25', bold: true },
              { text: data.tvaToPay >= 0 ? 'TVA nette due' : 'Crédit de TVA', bold: true },
              { text: fmt(Math.abs(data.tvaToPay)), alignment: 'right', bold: true, color: PRIMARY },
            ],
          ],
        },
        layout: tableLayout(),
      },
      { text: '\n\n' },
      {
        text: 'Ce document est une aide au remplissage de la déclaration de TVA (formulaires CA3 / CA12). Il ne constitue pas une déclaration officielle et ne se substitue pas à celle-ci.',
        style: 'mentions',
      },
    ];

    await saveOrDownloadPdf(baseDocDef(content), `Rapport_TVA_${periodMode}_${year}.pdf`);
  }

  // ----- 3. REGISTRE DES ACHATS (Micro-BIC) -----
  /** Utilise les achats issus de Stock & Achat (parametre/stock_articles.json) */
  static async generateRegistreAchatsPDF(
    entries: AchatRegistreEntry[],
    year: number,
    emetteur: Emetteur
  ): Promise<void> {
    await loadFonts();

    const lines = entries.map((e) => ({
      date: fmtDate(e.date),
      designation: e.designation,
      fournisseur: e.fournisseur,
      referenceFacture: e.referenceFacture,
      montantHT: e.montantHT,
      tva: e.tva,
      montantTTC: e.montantTTC,
      categorie: e.categorie || 'Non classé',
    }));

    const totalHT = lines.reduce((s, l) => s + l.montantHT, 0);
    const totalTVA = lines.reduce((s, l) => s + l.tva, 0);
    const totalTTC = lines.reduce((s, l) => s + l.montantTTC, 0);

    const catTotals: Record<string, number> = {};
    const monthlyByCategory: Record<string, number[]> = {};
    lines.forEach(l => {
      catTotals[l.categorie] = (catTotals[l.categorie] || 0) + l.montantTTC;
    });
    entries.forEach(e => {
      const cat = e.categorie || 'Non classé';
      if (!monthlyByCategory[cat]) monthlyByCategory[cat] = new Array(12).fill(0);
      const m = e.date.getMonth();
      monthlyByCategory[cat][m] += e.montantTTC;
    });

    const content: any[] = [
      ...buildEmetteurHeader(emetteur),
      { text: `REGISTRE DES ACHATS — ${year}`, style: 'title' },
      {
        text: "Registre des achats conformément à l'article 50-0 du Code Général des Impôts (obligation Micro-BIC).",
        style: 'mentions',
        margin: [0, 0, 0, 12],
      },
      {
        table: {
          headerRows: 1,
          widths: [52, '*', 70, 55, 55, 50, 55, 80],
          body: [
            [
              thCell('Date'),
              thCell('Désignation'),
              thCell('Fournisseur'),
              thCell('Ref facture'),
              thCell('HT', { alignment: 'right' }),
              thCell('TVA', { alignment: 'right' }),
              thCell('TTC', { alignment: 'right' }),
              thCell('Catégorie'),
            ],
            ...(lines.length > 0
              ? lines.map((l) => [
                  { text: l.date, fontSize: 8 },
                  { text: l.designation, fontSize: 8 },
                  { text: l.fournisseur, fontSize: 8 },
                  { text: l.referenceFacture, fontSize: 8 },
                  { text: fmt(l.montantHT), alignment: 'right' as const, fontSize: 8 },
                  { text: fmt(l.tva), alignment: 'right' as const, fontSize: 8 },
                  { text: fmt(l.montantTTC), alignment: 'right' as const, fontSize: 8 },
                  { text: l.categorie, fontSize: 8 },
                ])
              : [[
                  { text: 'Aucun achat enregistré pour cette période.', colSpan: 8, alignment: 'center' as const },
                  {}, {}, {}, {}, {}, {}, {},
                ]]),
          ],
        },
        layout: tableLayout(),
      },
      { text: '\n' },
      { text: 'Répartition mensuelle par catégorie', style: 'subheader' },
      (() => {
        const catsSorted = Object.entries(catTotals)
          .filter(([, total]) => total > 0)
          .sort((a, b) => b[1] - a[1]);
        if (catsSorted.length === 0) {
          return { text: 'Aucune donnée par catégorie.', italics: true, color: SECONDARY, margin: [0, 0, 0, 12] };
        }
        const monthNames = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
        const headerRow = [
          thCell('Mois'),
          ...catsSorted.map(([cat]) => thCell(cat, { alignment: 'right' })),
          thCell('Total', { alignment: 'right' }),
        ];
        const tableBody: any[][] = [headerRow];
        let grandTotal = 0;
        for (let m = 0; m < 12; m++) {
          let rowTotal = 0;
          const row: any[] = [
            { text: monthNames[m] },
            ...catsSorted.map(([cat]) => {
              const amt = monthlyByCategory[cat]?.[m] ?? 0;
              rowTotal += amt;
              return { text: fmt(amt), alignment: 'right' as const, fontSize: 8 };
            }),
            { text: fmt(rowTotal), alignment: 'right' as const, fontSize: 8 },
          ];
          grandTotal += rowTotal;
          tableBody.push(row);
        }
        tableBody.push([
          { text: 'TOTAL', bold: true, fontSize: 8 },
          ...catsSorted.map(([cat]) => ({ text: fmt(catTotals[cat] || 0), alignment: 'right' as const, bold: true })),
          { text: fmt(grandTotal), alignment: 'right' as const, bold: true, color: PRIMARY },
        ]);
        const widths: (string | number)[] = ['auto', ...catsSorted.map(() => 'auto'), 55];
        return {
          table: {
            headerRows: 1,
            widths,
            body: tableBody,
          },
          layout: tableLayout(),
          margin: [0, 0, 0, 12],
        };
      })(),
      { text: '\n' },
      {
        columns: [
          { text: '', width: '*' },
          {
            width: 'auto',
            table: {
              body: [
                [{ text: 'Total HT', bold: true }, { text: fmt(totalHT), alignment: 'right', bold: true }],
                [{ text: 'Total TVA', bold: true }, { text: fmt(totalTVA), alignment: 'right', bold: true }],
                [{ text: 'Total TTC', bold: true, color: PRIMARY }, { text: fmt(totalTTC), alignment: 'right', bold: true, color: PRIMARY }],
              ],
            },
            layout: 'noBorders',
          },
        ],
      },
      { text: '\n\n' },
      {
        text: `Document généré le ${fmtDate(new Date())}. Ne se substitue pas aux déclarations fiscales obligatoires.`,
        style: 'mentions',
      },
    ];

    await saveOrDownloadPdf(baseDocDef(content), `Registre_Achats_${year}.pdf`);
  }

  // ----- 4. RAPPORT D'ACTIVITÉ ANNUEL -----
  /** Inclut les factures (CA), les charges (selon modèle en vigueur : catégories ou manuel) et les achats Stock & Achat */
  static async generateRapportActivitePDF(
    factures: Facture[],
    subscriptions: Subscription[],
    achatsStock: AchatRegistreEntry[],
    year: number,
    emetteur: Emetteur,
    project?: Project | null,
    categoryChargesData?: CategoryChargesData | null
  ): Promise<void> {
    await loadFonts();

    const yearFactures = factures.filter(f => {
      const d = new Date(f.dateEmission);
      return d.getFullYear() === year && !f.supprime;
    });

    const caHT = yearFactures.reduce((s, f) => s + f.totalHT, 0);
    const caTVA = yearFactures.reduce((s, f) => s + Object.values(f.totalTVA).reduce((a, b) => a + b, 0), 0);
    const caTTC = yearFactures.reduce((s, f) => s + f.totalTTC, 0);

    const totalAchatsStockHT = achatsStock.reduce((s, a) => s + a.montantHT, 0);
    const monthlyAchatsByMonth: number[] = new Array(12).fill(0);
    achatsStock.forEach(a => {
      monthlyAchatsByMonth[a.date.getMonth()] += a.montantHT;
    });

    const isCategoryMode = project?.chargesMode === 'categories' && categoryChargesData && categoryChargesData.categories.length > 0;

    let totalChargesHT = totalAchatsStockHT;
    const monthlyCharges: number[] = new Array(12).fill(0);
    monthlyAchatsByMonth.forEach((amt, m) => { monthlyCharges[m] += amt; });

    let chargesByCategory: Record<string, number> = {};
    let monthlyChargesByCategory: Record<string, number[]> = {};

    if (isCategoryMode && categoryChargesData) {
      const monthKeys = Object.keys(categoryChargesData.totalByMonth)
        .filter((mk) => mk.startsWith(String(year)))
        .sort();
      const catsWithData = categoryChargesData.categories.filter((c) => c.total > 0);

      for (const mk of monthKeys) {
        const rowTotal = categoryChargesData.totalByMonth[mk] ?? 0;
        totalChargesHT += rowTotal;
        const m = parseInt(mk.slice(5), 10) - 1;
        if (m >= 0 && m < 12) monthlyCharges[m] += rowTotal;
      }

      catsWithData.forEach((cat) => {
        chargesByCategory[cat.name] = 0;
        monthlyChargesByCategory[cat.name] = new Array(12).fill(0);
        for (let m = 0; m < 12; m++) {
          const mk = `${year}-${String(m + 1).padStart(2, '0')}`;
          const amt = cat.monthlyAmounts[mk] ?? 0;
          chargesByCategory[cat.name] += amt;
          monthlyChargesByCategory[cat.name][m] = amt;
        }
      });

      achatsStock.forEach(a => {
        const cat = a.categorie && a.categorie !== '—' ? a.categorie : 'Achats divers';
        chargesByCategory[cat] = (chargesByCategory[cat] || 0) + a.montantHT;
        if (!monthlyChargesByCategory[cat]) monthlyChargesByCategory[cat] = new Array(12).fill(0);
        monthlyChargesByCategory[cat][a.date.getMonth()] += a.montantHT;
      });
    } else {
      const flat = ProjectionService.getAllFlatSubscriptions(subscriptions);
      const debits = flat.filter(s => s.type === 'debit');

      debits.forEach(sub => {
        const monthly = getMonthlyEquivalent(sub.amount, sub.periodicity);
        for (let m = 0; m < 12; m++) {
          const date = new Date(year, m, 1);
          if (sub.startDate && date < new Date(sub.startDate)) continue;
          if (sub.endDate && date > new Date(sub.endDate)) continue;
          totalChargesHT += monthly;
          monthlyCharges[m] += monthly;
        }
      });

      debits.forEach(sub => {
        const cat = sub.fiscalCategory
          ? (FISCAL_CAT_LABELS[sub.fiscalCategory] || sub.fiscalCategory)
          : 'Non classé';
        const monthly = getMonthlyEquivalent(sub.amount, sub.periodicity);
        if (!monthlyChargesByCategory[cat]) monthlyChargesByCategory[cat] = new Array(12).fill(0);
        for (let m = 0; m < 12; m++) {
          const date = new Date(year, m, 1);
          if (sub.startDate && date < new Date(sub.startDate)) continue;
          if (sub.endDate && date > new Date(sub.endDate)) continue;
          chargesByCategory[cat] = (chargesByCategory[cat] || 0) + monthly;
          monthlyChargesByCategory[cat][m] += monthly;
        }
      });

      achatsStock.forEach(a => {
        const cat = a.categorie && a.categorie !== '—' ? a.categorie : 'Achats divers';
        chargesByCategory[cat] = (chargesByCategory[cat] || 0) + a.montantHT;
        if (!monthlyChargesByCategory[cat]) monthlyChargesByCategory[cat] = new Array(12).fill(0);
        monthlyChargesByCategory[cat][a.date.getMonth()] += a.montantHT;
      });
    }

    const resultatNet = caHT - totalChargesHT;

    const monthlyCA: number[] = new Array(12).fill(0);
    yearFactures.forEach(f => {
      const m = new Date(f.dateEmission).getMonth();
      monthlyCA[m] += f.totalHT;
    });

    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    const nbFactures = yearFactures.length;
    const nbClients = new Set(yearFactures.map(f => f.clientId)).size;
    const totalChargesProjeteesHT = totalChargesHT - totalAchatsStockHT;

    const content: any[] = [
      ...buildEmetteurHeader(emetteur),
      { text: `RAPPORT D'ACTIVITÉ — ${year}`, style: 'title' },

      { text: 'Synthèse annuelle', style: 'subheader' },
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            [{ text: 'Nombre de factures émises' }, { text: `${nbFactures}`, alignment: 'right', bold: true }],
            [{ text: 'Nombre de clients' }, { text: `${nbClients}`, alignment: 'right', bold: true }],
            [{ text: "Chiffre d'affaires HT" }, { text: fmt(caHT), alignment: 'right', bold: true }],
            [{ text: 'TVA collectée' }, { text: fmt(caTVA), alignment: 'right' }],
            [{ text: "Chiffre d'affaires TTC" }, { text: fmt(caTTC), alignment: 'right' }],
            [{ text: 'Charges projetées HT' }, { text: fmt(totalChargesProjeteesHT), alignment: 'right', fontSize: 9 }],
            [{ text: 'Achats Stock & Achat HT' }, { text: fmt(totalAchatsStockHT), alignment: 'right', fontSize: 9 }],
            [{ text: 'Total charges HT' }, { text: fmt(totalChargesHT), alignment: 'right', color: '#dc2626' }],
            [{ text: 'Résultat net estimé (HT)', bold: true, color: PRIMARY }, { text: fmt(resultatNet), alignment: 'right', bold: true, color: resultatNet >= 0 ? '#16a34a' : '#dc2626' }],
          ],
        },
        layout: {
          hLineWidth: (i: number, node: any) => i === 0 || i === node.table.body.length ? 0.5 : 0.25,
          vLineWidth: () => 0,
          hLineColor: () => BORDER_COLOR,
          fillColor: (i: number, node: any) => i === node.table.body.length - 1 ? '#f0f9ff' : null,
        },
        margin: [0, 0, 0, 12],
      },

      { text: 'Répartition des charges par catégorie et par mois', style: 'subheader' },
      (() => {
        const catsSorted = Object.entries(chargesByCategory)
          .filter(([, total]) => total > 0)
          .sort((a, b) => b[1] - a[1]);
        if (catsSorted.length === 0) {
          return { text: 'Aucune charge par catégorie.', italics: true, color: SECONDARY, margin: [0, 0, 0, 12] };
        }
        const monthLabels = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
        const headerRow = [
          thCell('Mois'),
          ...catsSorted.map(([cat]) => thCell(cat, { alignment: 'right' })),
          thCell('Total', { alignment: 'right' }),
        ];
        const tableBody: any[][] = [headerRow];
        let grandTotal = 0;
        for (let m = 0; m < 12; m++) {
          let rowTotal = 0;
          const row: any[] = [
            { text: monthLabels[m] },
            ...catsSorted.map(([cat]) => {
              const amt = monthlyChargesByCategory[cat]?.[m] ?? 0;
              rowTotal += amt;
              return { text: fmt(amt), alignment: 'right' as const, fontSize: 9 };
            }),
            { text: fmt(rowTotal), alignment: 'right' as const, fontSize: 9 },
          ];
          grandTotal += rowTotal;
          tableBody.push(row);
        }
        tableBody.push([
          { text: 'TOTAL', bold: true, fontSize: 9 },
          ...catsSorted.map(([cat]) => ({ text: fmt(chargesByCategory[cat] || 0), alignment: 'right' as const, bold: true })),
          { text: fmt(grandTotal), alignment: 'right' as const, bold: true, color: PRIMARY },
        ]);
        const widths: (string | number)[] = ['auto', ...catsSorted.map(() => 'auto'), 55];
        return {
          table: {
            headerRows: 1,
            widths,
            body: tableBody,
          },
          layout: tableLayout(),
          margin: [0, 0, 0, 12],
        };
      })(),

      { text: 'Détail mensuel (CA, charges, résultat)', style: 'subheader' },
      {
        table: {
          headerRows: 1,
          widths: [65, 65, 65, 65],
          body: [
            [
              thCell('Mois'),
              thCell('CA HT', { alignment: 'right' }),
              thCell('Charges HT', { alignment: 'right' }),
              thCell('Résultat', { alignment: 'right' }),
            ],
            ...monthNames.map((name, i) => {
              const net = monthlyCA[i] - monthlyCharges[i];
              return [
                { text: name },
                { text: fmt(monthlyCA[i]), alignment: 'right' },
                { text: fmt(monthlyCharges[i]), alignment: 'right' },
                { text: fmt(net), alignment: 'right', color: net >= 0 ? '#16a34a' : '#dc2626' },
              ];
            }),
            [
              { text: 'TOTAL', bold: true },
              { text: fmt(caHT), alignment: 'right', bold: true },
              { text: fmt(totalChargesHT), alignment: 'right', bold: true },
              { text: fmt(resultatNet), alignment: 'right', bold: true, color: resultatNet >= 0 ? '#16a34a' : '#dc2626' },
            ],
          ],
        },
        layout: tableLayout(),
      },
      { text: '\n\n' },
      {
        text: `Rapport d'activité généré le ${fmtDate(new Date())}. Ce document est un récapitulatif indicatif et ne se substitue pas aux déclarations fiscales ou comptables obligatoires.`,
        style: 'mentions',
      },
    ];

    await saveOrDownloadPdf(baseDocDef(content), `Rapport_Activite_${year}.pdf`);
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

    const emetteur = await EmetteurService.loadEmetteur();
    if (!emetteur) {
      throw new Error('Émetteur non configuré');
    }

    const content: any[] = [
      ...buildEmetteurHeader(emetteur),
      { text: 'RAPPORT DES CHARGES', style: 'title', margin: [0, 0, 0, 8] },
    ];

    const isCategoryMode = categoryChargesData && categoryChargesData.categories.length > 0;

    if (isCategoryMode) {
      const { categories: catData, referencePeriod, totalByMonth } = categoryChargesData;
      content.push({
        text: `Période de référence : du ${fmtDate(referencePeriod.startDate)} au ${fmtDate(referencePeriod.endDate)}`,
        fontSize: 9,
        margin: [0, 0, 0, 12],
      });

      const monthKeys = Object.keys(totalByMonth).sort();
      const catsWithData = catData.filter((c) => c.total > 0);

      // Tableau transposé : Mois en lignes, Catégories en colonnes (optimise l'espace)
      const headerRow: any[] = [
        thCell('Mois'),
        ...catsWithData.map((c) => thCell(c.name, { alignment: 'right' })),
        thCell('Total', { alignment: 'right' }),
      ];

      const tableBody: any[][] = [headerRow];
      let grandTotal = 0;

      for (const mk of monthKeys) {
        const monthLabel = `${mk.slice(5)}/${mk.slice(2, 4)}`;
        const rowTotal = totalByMonth[mk] ?? 0;
        grandTotal += rowTotal;
        const row: any[] = [
          { text: monthLabel, fontSize: 9 },
          ...catsWithData.map((cat) => ({ text: fmt(cat.monthlyAmounts[mk] ?? 0), alignment: 'right' as const, fontSize: 9 })),
          { text: fmt(rowTotal), alignment: 'right' as const, fontSize: 9 },
        ];
        tableBody.push(row);
      }

      tableBody.push([
        { text: 'TOTAL', bold: true, fontSize: 9 },
        ...catsWithData.map((cat) => ({ text: fmt(cat.total), alignment: 'right' as const, bold: true })),
        { text: fmt(grandTotal), alignment: 'right' as const, bold: true },
      ]);

      const widths: (string | number)[] = ['auto', ...catsWithData.map(() => 'auto'), 55];

      content.push({
        table: {
          headerRows: 1,
          widths,
          body: tableBody,
        },
        layout: tableLayout(),
        margin: [0, 0, 0, 16],
      });
    } else {
      const flatSubs = ProjectionService.getAllFlatSubscriptions(project.subscriptions);
      const debitSubs = flatSubs.filter((s) => s.type === 'debit');

      content.push({
        text: `Période de projection : du ${fmtDate(project.projectionConfig.startDate)} au ${fmtDate(project.projectionConfig.endDate)}`,
        fontSize: 9,
        margin: [0, 0, 0, 12],
      });

      if (debitSubs.length === 0) {
        content.push({
          text: 'Aucune charge récurrente configurée.',
          italics: true,
          color: SECONDARY,
        });
      } else {
        const tableBody: any[][] = [
          [
            thCell('Nom'),
            thCell('Montant', { alignment: 'right' }),
            thCell('Périodicité'),
            thCell('Date début'),
            thCell('Date fin'),
          ],
        ];

        let totalCharges = 0;
        for (const sub of debitSubs) {
          const startD = sub.startDate instanceof Date ? sub.startDate : new Date(sub.startDate);
          const endD = sub.endDate ? (sub.endDate instanceof Date ? sub.endDate : new Date(sub.endDate)) : null;
          tableBody.push([
            { text: sub.name, fontSize: 9 },
            { text: fmt(sub.amount), alignment: 'right' as const },
            { text: PERIODICITY_LABELS[sub.periodicity] || sub.periodicity, fontSize: 9 },
            { text: fmtDate(startD), fontSize: 9 },
            { text: endD ? fmtDate(endD) : '—', fontSize: 9 },
          ]);
          totalCharges += Math.abs(sub.amount);
        }

        tableBody.push([
          { text: 'Total charges (montants bruts)', colSpan: 4, bold: true },
          {},
          {},
          {},
          { text: fmt(totalCharges), alignment: 'right' as const, bold: true },
        ]);

        content.push({
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto'],
            body: tableBody,
          },
          layout: tableLayout(),
          margin: [0, 0, 0, 16],
        });
      }
    }

    const now = new Date();
    const fileName = `Charges_Entreprise_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.pdf`;
    await saveOrDownloadPdf(baseDocDef(content), fileName);
  }
}
