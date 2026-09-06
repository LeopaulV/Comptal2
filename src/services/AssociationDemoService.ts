import { Client, EMPTY_ADRESSE } from '../types/invoice';
import {
  DEMO_DONATION_IDS,
  DEMO_DONOR_IDS,
  DEMO_RULE_ID,
  EXAMPLE_ASSOCIATION_CONFIG,
  demoDate,
} from '../constants/associationDemo';
import { AssociationConfigService } from './AssociationConfigService';
import { AssociationPDFService } from './AssociationPDFService';
import { ClientService } from './ClientService';
import { Db } from './db';
import { DonationService } from './DonationService';
import { RegisterPDFService } from './RegisterPDFService';
import { RegisterService } from './RegisterService';
import { RegistreRecusService } from './RegistreRecusService';
import { withLog } from './logger';

function donor(partial: Partial<Client> & Pick<Client, 'id' | 'type'>): Client {
  const now = new Date();
  return {
    roles: ['donateur'],
    adresseFacturation: { ...EMPTY_ADRESSE, pays: 'France' },
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export const AssociationDemoService = {
  async hasExampleData(): Promise<boolean> {
    const existing = await ClientService.getClientById(DEMO_DONOR_IDS.martin);
    if (existing) return true;
    const donations = await DonationService.list();
    return donations.length > 0;
  },

  async seed(): Promise<{ donations: number; receipts: number; documents: number }> {
    return withLog('AssociationDemoService.seed', async () => {
      const config = await AssociationConfigService.getOrCreateConfig();
      if (!config.denominationSociale.trim()) {
        await AssociationConfigService.saveConfig({
          ...EXAMPLE_ASSOCIATION_CONFIG,
          pdfTemplateRecuFiscal: config.pdfTemplateRecuFiscal,
          nextReceiptNumber: config.nextReceiptNumber ?? 0,
        });
      }

      const martin = await ClientService.upsertClient(donor({
        id: DEMO_DONOR_IDS.martin,
        type: 'particulier',
        civilite: 'M.',
        nom: 'Martin',
        prenom: 'Paul',
        email: 'paul.martin@email.fr',
        telephone: '06 12 34 56 78',
        adresseFacturation: { rue: '4 allée des Tilleuls', codePostal: '69007', ville: 'Lyon', pays: 'France' },
        notes: 'Donateur exemple — particulier',
      }));
      const bernard = await ClientService.upsertClient(donor({
        id: DEMO_DONOR_IDS.bernard,
        type: 'particulier',
        civilite: 'Mme',
        nom: 'Bernard',
        prenom: 'Claire',
        email: 'claire.bernard@email.fr',
        adresseFacturation: { rue: '27 quai Saint-Vincent', codePostal: '69001', ville: 'Lyon', pays: 'France' },
        notes: 'Donatrice exemple — particulière',
      }));
      const solaire = await ClientService.upsertClient(donor({
        id: DEMO_DONOR_IDS.solaire,
        type: 'entreprise',
        denominationSociale: 'Atelier Solaire',
        formeJuridique: 'SAS',
        siren: '832111000',
        siret: '83211100000021',
        email: 'mecenat@atelier-solaire.fr',
        adresseFacturation: { rue: '9 rue de la Soie', codePostal: '69100', ville: 'Villeurbanne', pays: 'France' },
        notes: 'Mécène exemple — personne morale',
      }));

      const donations = await Promise.all([
        DonationService.save({
          id: DEMO_DONATION_IDS.martinVirement,
          contactId: martin.id,
          anonymous: false,
          natureDon: 'numeraire',
          modeVersement: 'virement',
          montant: 120,
          date: demoDate(1, 15),
          datePerception: demoDate(1, 15),
          description: 'Don mensuel — adhésion de soutien',
          receiptEligible: true,
        }),
        DonationService.save({
          id: DEMO_DONATION_IDS.bernardCheque,
          contactId: bernard.id,
          anonymous: false,
          natureDon: 'numeraire',
          modeVersement: 'cheque',
          montant: 80,
          date: demoDate(3, 8),
          datePerception: demoDate(3, 8),
          description: 'Don ponctuel chèque',
          receiptEligible: true,
        }),
        DonationService.save({
          id: DEMO_DONATION_IDS.martinNature,
          contactId: martin.id,
          anonymous: false,
          natureDon: 'nature',
          montant: 250,
          date: demoDate(4, 22),
          datePerception: demoDate(4, 22),
          description: 'Ordinateur portable reconditionné',
          valuationMethod: 'Valeur de marché constatée',
          valuationProvidedByDonor: true,
          receiptEligible: true,
        }),
        DonationService.save({
          id: DEMO_DONATION_IDS.solaireVirement,
          contactId: solaire.id,
          anonymous: false,
          natureDon: 'numeraire',
          modeVersement: 'virement',
          montant: 1500,
          date: demoDate(6, 3),
          datePerception: demoDate(6, 3),
          description: 'Mécénat financier — programme éducatif',
          receiptEligible: true,
        }),
        DonationService.save({
          id: DEMO_DONATION_IDS.solaireMecenat,
          contactId: solaire.id,
          anonymous: false,
          natureDon: 'mecenat_competences',
          montant: 800,
          date: demoDate(7, 14),
          datePerception: demoDate(7, 14),
          description: 'Mise à disposition d’un développeur, 2 jours',
          valuationMethod: 'Coût de revient salarial',
          valuationProvidedByDonor: true,
          receiptEligible: true,
        }),
        DonationService.save({
          id: DEMO_DONATION_IDS.anonyme,
          contactId: null,
          anonymous: true,
          donorLabel: 'Collecte boîte n° 2',
          natureDon: 'numeraire',
          modeVersement: 'especes',
          montant: 45,
          date: demoDate(9, 1),
          datePerception: demoDate(9, 1),
          description: 'Dons en espèces non identifiés',
          receiptEligible: false,
        }),
      ]);

      await Db.execute(
        `INSERT OR IGNORE INTO donation_rules
         (id, contact_id, label_contains, category_code, payment_method, active, created_at)
         VALUES (?, ?, ?, NULL, 'virement', 1, ?)`,
        [DEMO_RULE_ID, solaire.id, 'SOLAIRE', new Date().toISOString()]
      );

      const registre = await RegistreRecusService.loadRegistre();
      let receipts = 0;
      const toReceipt = donations.filter((donation) =>
        donation.id === DEMO_DONATION_IDS.martinVirement
        || donation.id === DEMO_DONATION_IDS.solaireVirement
      );
      for (const donation of toReceipt) {
        if (donation.receiptId || registre.some((entry) => entry.donationId === donation.id)) {
          receipts += 1;
          continue;
        }
        const contact = donation.contactId === martin.id ? martin : solaire;
        const result = await AssociationPDFService.generateForDonation(donation, contact, { open: false });
        await DonationService.markReceipt(donation.id, result.receiptId);
        receipts += 1;
        if (donation.id === DEMO_DONATION_IDS.martinVirement) {
          await RegistreRecusService.annulerRecu(result.receiptId);
        }
      }

      const existingDocs = await RegisterService.listDocuments();
      const yearStart = `${new Date().getFullYear()}-01-01`;
      const today = new Date().toISOString().slice(0, 10);
      const wanted = [
        { type: 'donation_journal' as const, title: 'Exemple — Journal chronologique des dons' },
        { type: 'tax_receipt_register' as const, title: 'Exemple — Registre des reçus fiscaux' },
        { type: 'annual_donation_statement' as const, title: 'Exemple — État annuel des reçus fiscaux' },
      ];
      let documents = 0;
      for (const item of wanted) {
        if (existingDocs.some((doc) => doc.snapshot.registerType === item.type && doc.title.startsWith('Exemple'))) {
          documents += 1;
          continue;
        }
        const document = await RegisterService.generate({
          type: item.type,
          title: item.title,
          periodStart: yearStart,
          periodEnd: today,
          notes: 'Document d’exemple généré automatiquement à partir des dons de démonstration.',
        });
        const settings = await RegisterService.loadSettings();
        const path = await RegisterPDFService.generate(document, settings);
        await RegisterService.setPdfPath(document.id, path);
        documents += 1;
      }

      return { donations: donations.length, receipts, documents };
    });
  },
};
