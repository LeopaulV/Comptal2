# Page Contacts

**Route canonique** : `#/clients`  
**Alias** : `#/contacts`  
**Page** : `src/pages/Client/Client.tsx`

## Rôle

La page gère les contacts utilisés par la facturation. Un contact peut être un particulier ou une
entreprise, appartenir à un groupement et contenir des informations optionnelles.
Elle ne duplique pas les KPI Devis/Factures/Reste à encaisser : ces indicateurs restent sur la page
Facturation.

## Modèle

`Client` contient notamment :

- identité particulier ou raison sociale ;
- code client généré ;
- adresses de facturation et de livraison ;
- téléphone, courriel et notes ;
- groupement, champs personnalisés et coordonnées bancaires ;
- statut archivé et dates de création/mise à jour.

La ligne SQLite `clients` duplique `code_client`, `type`, `archived` et `updated_at` pour les
opérations courantes ; le champ `payload` contient l’objet complet.

## Fonctions

| Action | Composant/service | Comportement |
|---|---|---|
| Afficher l’arbre | `ClientTree` | Regroupe et filtre les contacts |
| Créer/modifier | `ContactFicheModal` + `ClientService.upsertClient` | Normalise les dates et génère le code si absent |
| Voir les éléments liés | `ContactElementModal` | Charge devis/factures du contact |
| Créer un don depuis la fiche | `DonationFormModal` + `DonationService` | Contact déjà sélectionné |
| Rechercher une entreprise | `EntrepriseSearch` + `SireneAPIService` | Interroge l’API publique configurée |
| Rechercher localement | `ClientService.searchClients` | Nom, société, courriel, téléphone, SIREN/SIRET, code |
| Gérer les groupes | `ContactGroupService` | CRUD de `contact_groups` |

## Code client

Pour un particulier, le préfixe utilise les initiales nom/prénom. Pour une entreprise, il utilise
les deux premières lettres alphanumériques de la dénomination. Un suffixe numérique sur trois
chiffres est incrémenté parmi les codes déjà présents.

## Liens documentaires

Les devis et factures stockent `client_id`. Ce lien est logique mais n’est pas une contrainte FK
SQLite. Une suppression de contact doit donc être examinée en tenant compte des documents associés ;
l’archivage est préférable lorsqu’un historique existe.

## Voir aussi

- [Carte Contacts](../cartes/contacts.md)
- [Page Facturation](./facturation.md)
