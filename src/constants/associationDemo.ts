import { AssociationConfig } from '../types/association';
import { EMPTY_ADRESSE } from '../types/invoice';

const year = () => new Date().getFullYear();

export const DEMO_DONOR_IDS = {
  martin: 'demo-donor-martin',
  bernard: 'demo-donor-bernard',
  solaire: 'demo-donor-solaire',
} as const;

export const DEMO_DONATION_IDS = {
  martinVirement: 'demo-don-martin-virement',
  bernardCheque: 'demo-don-bernard-cheque',
  martinNature: 'demo-don-martin-nature',
  solaireMecenat: 'demo-don-solaire-mecenat',
  solaireVirement: 'demo-don-solaire-virement',
  anonyme: 'demo-don-anonyme',
} as const;

export const DEMO_RULE_ID = 'demo-donrule-solaire';

export const EXAMPLE_ASSOCIATION_CONFIG: AssociationConfig = {
  denominationSociale: 'Association Comptal Solidarité',
  objetSocial: 'Soutien éducatif, culturel et d’insertion auprès des publics éloignés.',
  rna: 'W691234567',
  siren: '810123456',
  siret: '81012345600017',
  formeJuridique: 'Association loi 1901',
  adresse: {
    ...EMPTY_ADRESSE,
    rue: '18 rue des Oliviers',
    codePostal: '69003',
    ville: 'Lyon',
    pays: 'France',
  },
  telephone: '04 78 00 00 00',
  email: 'contact@comptal-solidarite.fr',
  siteWeb: 'https://comptal-solidarite.fr',
  statutOIG: true,
  datePublicationJO: `${year() - 4}-03-12`,
  dateCreation: `${year() - 12}-05-20`,
  prefectureDeclaration: 'Préfecture du Rhône',
  numeroRecepisse: 'W691234567-REC',
  referencesCGI: 'Articles 200 et 238 bis du code général des impôts',
  signataireNom: 'Marie Lefèvre',
  signataireQualite: 'Présidente',
  nextReceiptNumber: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export function withExampleAssociation(config: AssociationConfig): AssociationConfig {
  const example = EXAMPLE_ASSOCIATION_CONFIG;
  return {
    ...config,
    denominationSociale: config.denominationSociale || example.denominationSociale,
    objetSocial: config.objetSocial || example.objetSocial,
    rna: config.rna || example.rna,
    siren: config.siren || example.siren,
    siret: config.siret || example.siret,
    formeJuridique: config.formeJuridique || example.formeJuridique,
    telephone: config.telephone || example.telephone,
    email: config.email || example.email,
    siteWeb: config.siteWeb || example.siteWeb,
    statutOIG: typeof config.statutOIG === 'boolean' ? config.statutOIG : example.statutOIG,
    datePublicationJO: config.datePublicationJO || example.datePublicationJO,
    referencesCGI: config.referencesCGI || example.referencesCGI,
    signataireNom: config.signataireNom || example.signataireNom,
    signataireQualite: config.signataireQualite || example.signataireQualite,
    adresse: {
      rue: config.adresse.rue || example.adresse.rue,
      codePostal: config.adresse.codePostal || example.adresse.codePostal,
      ville: config.adresse.ville || example.adresse.ville,
      pays: config.adresse.pays || example.adresse.pays,
    },
  };
}

export function demoDate(month: number, day: number): string {
  return `${year()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
