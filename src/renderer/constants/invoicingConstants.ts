export const FORMES_JURIDIQUES = [
  { value: 'SARL', label: 'SARL - Société à Responsabilité Limitée' },
  { value: 'SAS', label: 'SAS - Société par Actions Simplifiée' },
  { value: 'SASU', label: 'SASU - Société par Actions Simplifiée Unipersonnelle' },
  { value: 'EURL', label: 'EURL - Entreprise Unipersonnelle à Responsabilité Limitée' },
  { value: 'SA', label: 'SA - Société Anonyme' },
  { value: 'SCI', label: 'SCI - Société Civile Immobilière' },
  { value: 'SNC', label: 'SNC - Société en Nom Collectif' },
  { value: 'EI', label: 'EI - Entreprise Individuelle' },
  { value: 'EIRL', label: 'EIRL - Entreprise Individuelle à Responsabilité Limitée' },
  { value: 'Association', label: 'Association loi 1901' },
  { value: 'Autre', label: 'Autre' },
];

export const CIVILITES = ['M.', 'Mme', 'Mlle', 'Dr.', 'Me'];

export const PAYS = ['France', 'Belgique', 'Suisse', 'Luxembourg', 'Monaco', 'Canada', 'Autre'];

export const UNITES_MESURE = [
  { value: 'unite', label: 'Unité' },
  { value: 'kg', label: 'Kilogramme (kg)' },
  { value: 'g', label: 'Gramme (g)' },
  { value: 'm', label: 'Mètre (m)' },
  { value: 'm2', label: 'Mètre carré (m²)' },
  { value: 'm3', label: 'Mètre cube (m³)' },
  { value: 'l', label: 'Litre (L)' },
  { value: 'heure', label: 'Heure' },
  { value: 'jour', label: 'Jour' },
  { value: 'forfait', label: 'Forfait' },
];

export const TAUX_TVA = [
  { value: 0, label: '0% - Exonéré' },
  { value: 2.1, label: '2,1% - Presse, médicaments' },
  { value: 5.5, label: '5,5% - Alimentation, livres' },
  { value: 10, label: '10% - Restauration, transports' },
  { value: 20, label: '20% - Taux normal' },
];

export const MODES_PAIEMENT = ['virement', 'cheque', 'especes', 'cb', 'prelevement', 'paypal', 'autre'];
