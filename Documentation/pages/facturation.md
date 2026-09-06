# Page Facturation

**Route canonique** : `#/facturation`  
**Alias** : `#/invoicing`  
**Page** : `src/pages/Facturation/Facturation.tsx`

## Rôle

La facturation suit un flux unique : un devis appartient à un contact et peut produire une ou
plusieurs factures rattachées. Les documents et le catalogue de postes sont présentés dans deux
onglets.

## Onglets

| Onglet | Composant | Contenu |
|---|---|---|
| Devis / Factures | `DocumentsPanel` | KPI, documents, création/édition, paiements et pièces jointes |
| Postes | `PostesPanel` | Matériel, travail, groupes et secteurs réutilisables |

`DocumentsPanel` affiche le nombre de devis, le nombre de factures et le reste à encaisser. Les
documents sont regroupés par client : un devis peut être déplié pour afficher ses factures, tandis
que les factures sans devis restent identifiables séparément.

## Documents

`DocumentEditor` édite les champs communs. `DevisModal` et `FactureModal` orchestrent les variantes.
`InvoiceService` calcule chaque ligne puis les totaux :

- matériel : prix unitaire × quantité, remise, marge et transport ;
- travail : taux horaire × heures × intervenants, marge et déplacement ;
- TVA regroupée par taux ;
- total TTC = total HT + TVA.

Les heures de travail sont affichées en `hh:mm` et converties en nombre décimal par
`hoursToHhMm()`/`hhMmToHours()`.

## Cycle du devis

Un devis possède une date de validité et un statut. Il n’est pas supprimé du flux métier : la
caducité exige une signature, mémorise la date et éventuellement un motif, puis conserve le document
avec `statut='caduc'`.

Les scans ou PDF signés par le client sont distincts du PDF généré. `AttachmentService` peut copier
le fichier sous le profil.

## Facture et paiement

Une facture issue d’un devis conserve `devisOrigine`. `PaymentTrackingService` :

1. calcule le montant déjà payé et le reste ;
2. recherche les transactions créditrices non liées ;
3. compare le numéro dans le libellé et la proximité du montant (tolérance 0,05) ;
4. crée un paiement lié **ou** une saisie manuelle chèque/espèces qui **insère une transaction de trésorerie** (`EditionService.insert`, libellé « suivi, pas une caisse ») — ce n’est pas un TPV / NF 525 ;
5. recalcule `brouillon`, `envoyee`, `payee_partiellement`, `payee` ou `en_retard`.

Une facture **émise** (statut autre que brouillon) est en lecture seule dans `DocumentEditor`. La correction passe par un **avoir** (`InvoiceService.createAvoir`, nouveau numéro). Le PDF est généré depuis le **snapshot vendeur** figé à l’émission (identité, SIREN client, TVA par taux, mentions 293 B / pénalités / 40 € / escompte).

Une facture ne peut pas être créée à partir d’un devis caduc.
`GestionFactureRow` matérialise l’encaissement avec une barre de progression calculée sur les
paiements.

## Numérotation

- Devis : format paramétrable `{PREFIX}-{YEAR}-{SEQ:n}` (`prefixeDevis` ou code client).
- Facture : **série autonome** `{prefixeFacture}-{YEAR}-{SEQ}` — plus de `FAC-DEVIS-…` pour les nouveaux numéros (les anciens restent).
- `peekNextNumero` prévisualise sans persister ; `generateNumero` avance le compteur.

L’unicité est vérifiée par le service avant l’UPSERT. Les index SQLite accélèrent la recherche mais
ne sont pas déclarés `UNIQUE`.

## Persistance

Les tables `devis` et `factures` exposent les colonnes utiles au tri et conservent le document
complet en JSON. Les dates et paiements sont sérialisés en ISO, puis réhydratés au chargement.

## Voir aussi

- [Carte Facturation](../cartes/facturation.md)
- [Page Contacts](./contacts.md)
- [Carte générale des processus](../carte-processus-donnees.md)
