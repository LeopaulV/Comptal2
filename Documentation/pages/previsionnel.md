# Page Prévisionnel

**Route** : `#/previsionnel`  
**Alias** : `#/project-management`  
**Page** : `src/pages/Previsionnel/Previsionnel.tsx`

## Rôle

Prévisionnel permet de construire plusieurs scénarios financiers persistés, indépendants des
transactions réelles. Chaque scénario possède une période, un solde initial, un arbre de lignes
récurrentes et une disposition de widgets.

## Interface

| Zone | Composant | Fonctions |
|---|---|---|
| Barre supérieure | `PrevisionnelToolbar` | Charger/créer/supprimer, nom, dates, solde, actions de ligne |
| Panneau gauche | `ForecastGrid` | Grille métier, groupes, édition des cellules, colonnes et largeurs |
| Séparateur | `PrevisionnelSplit` | Ratio grille/widgets redimensionnable |
| Panneau droit | `PrevisionnelWidgetPanel` | Statistiques, solde, débit/crédit, catégories et lignes |
| Dialogues | `FromCategoryDialog`, `FromTransactionDialog` | Préremplir une ligne depuis une catégorie ou transaction |

Le clic droit dans la colonne Nom permet d’ajouter une ligne, un groupe ou une ligne préremplie
depuis une catégorie/transaction. Le menu d’en-tête permet d’afficher, masquer et typer les colonnes,
notamment la colonne Couleur.

## Données

- `projects` contient le scénario et `widget_layout`.
- `project_subscriptions` contient les lignes et groupes.
- `parent_id` construit l’arbre ; `sort_order` conserve l’ordre.
- `periodicity` accepte `unique`, `daily`, `weekly`, `monthly`, `quarterly`, `yearly`.
- `type` vaut `debit` ou `credit`.

## Modification

Une modification de configuration est persistée après un debounce de 350 ms. Une modification de
cellule existante appelle `ProjectService.updateSubscription`; une ligne vide devient une nouvelle
ligne à la première valeur utile. Saisir un nouveau nom de groupe crée ce groupe et y rattache la
ligne.

`resolveCategoryInput()` accepte un code, un nom exact ou une correspondance partielle unique. En
cas d’ambiguïté, le texte saisi est conservé.

## Calcul

`ForecastModel.computeForecast()` reçoit le projet, l’arbre, les catégories et la granularité. Il
s’appuie sur `ProjectionService` pour produire :

- occurrences par date ;
- débits, crédits et flux net ;
- solde cumulé ;
- agrégats par période ;
- répartitions par catégorie et par ligne.

Les widgets ne sont pas persistés sous forme de résultats : ils sont recalculés à partir des lignes.

## Garde-fous

- Un groupe ne peut pas être déplacé sous l’un de ses descendants.
- Supprimer un groupe supprime d’abord ses enfants directs.
- Le ratio du split est borné entre 35 % et 75 %.
- Les dates et montants sont normalisés avant persistance.

## Voir aussi

- [Carte Prévisionnel](../cartes/previsionnel.md)
- [Architecture et code](../architecture-et-code.md)
- [Base de développement](../base-developpement.md)
