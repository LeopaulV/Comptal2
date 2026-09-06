# Page Édition — Fonctionnement

**Route** : `#/edition`  
**Fichier** : `src/pages/Edition/Edition.tsx`  
**Plan** : 3 — Édition (réalisé)

---

## 1. Rôle

La page Édition est l'outil principal de **catégorisation et correction** des transactions importées. Elle affiche un tableau éditable alimenté par SQLite, avec filtres avancés, tri SQL, auto-catégorisation statistique, libellés routiniers et nettoyage des doublons.

La suppression d’une ligne **archive** la transaction (`deleted_at`) : elle sort de l’affichage et des stats, mais n’est pas effacée physiquement (conservation 10 ans). Ctrl+Z restaure la ligne.

---

## 2. Structure de l'interface

```
┌──────────────────────────────────────────────────────────────┐
│  EditionToolbar (actions + FilterPanels)                     │
├──────────────────────────────────────────────────────────────┤
│  TransactionTable (500 lignes/page, virtualisation, inline)  │
├──────────────────────────────────────────────────────────────┤
│  CategoryPanel (CRUD catégories à droite)                    │
└──────────────────────────────────────────────────────────────┘
```

Modales :
  - AutoCatReviewModal (suggestions auto-cat)
  - DuplicatesModal (doublons détectés)
  - RoutineLabelModal (mot du libellé → catégorie / étiquette)
  - ConfirmModal (suppression)

---

## 3. Filtres et recherche

| Filtre | État React | Traduction SQL |
|--------|------------|----------------|
| Comptes | `selectedAccounts` | `account_id IN (...)` |
| Catégories | `selectedCategories` | `category_code IN (...)` |
| Non catégorisées | `uncategorizedOnly` (défaut: true) | `category_code IS NULL OR = ''` |
| Période | `dateStart`, `dateEnd` | `date BETWEEN` |
| Recherche | `search` → debounce 300 ms → `searchDebounced` | `label LIKE` |

Tri : colonnes `date`, `value_date`, `label`, `debit`, `credit`, `category_code`, `account_id` — direction `asc`/`desc`/`null`.

---

## 4. Chargement des données

À chaque changement de filtre/page/tri :

```typescript
EditionService.list(filters)      // PAGE_SIZE = 500
EditionService.count(filters)     // total filtré
EditionService.count(baseFilters) // total global (hors uncategorizedOnly)
```

---

## 5. Édition inline

| Action | Déclencheur | Service |
|--------|-------------|---------|
| Modifier champ | `onUpdate(id, fields)` | `EditionService.update(id, fields)` |
| Apprendre catégorie | Si `categoryCode` modifié | `AutoCategorisationService.learn(label, code)` |
| Insérer ligne | Bouton ou menu contextuel avant/après | `EditionService.insert({...})` |
| Supprimer ligne | Bouton supprimer | `EditionService.remove(id)` |

Chaque modification déclenche `reloadRows()` pour rafraîchir la page courante.

**Avantage vs Comptal2** : édition par `id` PK stable (plus de clé composite fragile).

---

## 6. Historique annuler/refaire

`useEditionHistory` conserve jusqu’à 100 actions. Les boutons de la barre et les raccourcis
Ctrl+Z/Ctrl+Y rejouent l’état précédent ou suivant avec `EditionService.update`, `restore` ou
`remove`. `buildUpdateHistoryAction()` mémorise les valeurs avant/après d’une édition.

Une application groupée d’auto-catégorisation est enregistrée comme action `bulkUpdate`.

---

## 7. Auto-catégorisation

### Déclenchement
Bouton dans la toolbar → `runAutoCat()` :

1. `AutoCategorisationService.loadStats()` — charge `autocat_stats`
2. `EditionService.listUncategorized(baseFilters)` — transactions sans catégorie
3. Pour chaque ligne : `AutoCategorisationService.suggest(label, stats)`
4. Ouvre `AutoCatReviewModal` avec les suggestions

### Application
L'utilisateur valide les suggestions → `EditionService.applyCategories(updates)` + `AutoCategorisationService.learn()` pour chaque acceptation.

### Reconstruction des stats
Disponible dans Paramètres → Données : `AutoCategorisationService.rebuildFromTransactions()`.

---

## 8. Gestion des doublons

Bouton « Doublons » → `EditionService.findDuplicates()` :

- Requête SQL groupant par date + montant + libellé + compte
- Affichage dans `DuplicatesModal`
- Suppression groupée : `EditionService.deleteIds(ids)`

---

## 9. Tableau et préférences

- Les colonnes date, date de valeur, compte, libellé, débit, crédit et catégorie sont éditables.
- Le tri suit le cycle croissant → décroissant → désactivé.
- Au-delà du seuil de rendu, `TransactionTable` virtualise les lignes visibles.
- Les largeurs sont redimensionnables et persistées par profil via `EditionUiService` dans
  `parametre/edition_ui.json`.
- Valider une catégorie avec Entrée enregistre puis déplace le focus sur la ligne suivante.

---

## 10. Panneau catégories

`CategoryPanel` fournit le CRUD des catégories sans quitter Édition. Il s’appuie sur
`ConfigService`, actualise les couleurs/codes et recharge les références après mutation.

---

## 11. Composants

| Composant | Fichier |
|-----------|---------|
| `EditionToolbar` | `components/Edition/EditionToolbar.tsx` |
| `FilterPanels` | `components/Edition/FilterPanels.tsx` |
| `TransactionTable` | `components/Edition/TransactionTable.tsx` |
| `CategoryPanel` | `components/Edition/CategoryPanel.tsx` |
| `AutoCatReviewModal` | `components/Edition/AutoCatReviewModal.tsx` |
| `DuplicatesModal` | `components/Edition/DuplicatesModal.tsx` |
| `useEditionHistory` | `hooks/useEditionHistory.ts` |
| `EditionUiService` | `services/EditionUiService.ts` |

---

## 12. Voir aussi

- [Carte Édition](../cartes/edition.md)
- [Carte processus données](../carte-processus-donnees.md) — flux UPDATE
