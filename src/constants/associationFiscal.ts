/** Propositions CGI / fiscalité des dons — la saisie libre reste possible. */
export const CGI_REFERENCE_SUGGESTIONS = [
  {
    id: '200-238',
    value: 'Articles 200 et 238 bis du code général des impôts',
    label: 'Articles 200 et 238 bis du CGI',
    hint: 'Particuliers (IR) et entreprises (IS)',
  },
  {
    id: '200',
    value: 'Article 200 du code général des impôts (réduction d’impôt sur le revenu)',
    label: 'Article 200 du CGI',
    hint: 'Dons des particuliers — réduction IR',
  },
  {
    id: '238bis',
    value: 'Article 238 bis du code général des impôts (réduction d’impôt sur les sociétés)',
    label: 'Article 238 bis du CGI',
    hint: 'Dons des entreprises — réduction IS',
  },
  {
    id: 'oig',
    value: 'Organisme d’intérêt général au sens des articles 200 et 238 bis du CGI',
    label: 'Organisme d’intérêt général',
    hint: 'Mention OIG — art. 200 et 238 bis',
  },
  {
    id: 'rup',
    value: 'Association reconnue d’utilité publique (art. 200 et 238 bis du CGI)',
    label: 'Reconnue d’utilité publique',
    hint: 'Association RUP',
  },
  {
    id: 'ifi',
    value: 'Article 978 du CGI (réduction d’impôt sur la fortune immobilière)',
    label: 'Article 978 du CGI',
    hint: 'Dons ouvrant droit à réduction IFI',
  },
] as const;
