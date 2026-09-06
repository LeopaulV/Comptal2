# Page Dashboard — Fonctionnement

**Route** : `#/dashboard`  
**Fichier** : `src/pages/Dashboard/Dashboard.tsx`  
**Plan** : 4 — Dashboard (réalisé)

---

## 1. Rôle

Le Dashboard est la page d'accueil de Comptal2.1. Il présente une synthèse et des graphiques
alimentés par des agrégats SQL. Il n’affiche pas de tableau de transactions.

---

## 2. Structure de l'interface

```
┌──────────────────────────────────────────────────────────────┐
│  Barre latérale filtres (repliable)                          │
│  ├── Comptes (FilterBox)                                     │
│  ├── Catégories (FilterBox)                                  │
│  └── Période (dates + listes semaine/mois/année)             │
├──────────────────────────────────────────────────────────────┤
│  En-tête fixe : titre + export CSV                           │
│  Badge date-à-date + recherche libellé                       │
├──────────────────────────────────────────────────────────────┤
│  Onglets : [ Résumé | Graphiques ]                           │
│  ├── Résumé → DashboardSummaryPanel (KPI, mini-cartes)       │
│  └── Graphiques → DashboardChartsPanel (3 charts Chart.js)   │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Cycle de vie des données

### Chargement initial
1. `ConfigService.listAccounts()` et `listCategories()` — listes de référence
2. `StatsService.dateBounds()` — bornes min/max des transactions
3. `StatsService.distinctPeriods()` — listes semaine/mois/année dérivées des données
4. Sélection de tous les comptes et catégories

### Rechargement à chaque changement de filtre
Un `useEffect` déclenche `loadData()` qui exécute en parallèle :
- `StatsService.kpis(filters)` — revenus, dépenses, net, compteur, etc.
- `StatsService.categoryTotals(chartFilters)` — totaux par catégorie (graphiques)
- `StatsService.accountBalancesAt(dateEnd, accountIds)` — soldes comptes
- `StatsService.balancesOverPeriod(...)` — séries temporelles pour courbe de soldes

La granularité des courbes est calculée par `autoGranularity(dateStart, dateEnd)`.

### Export
Bouton export → `ExportService.exportTransactionsCsv(filters)` → dialog de sauvegarde → fichier CSV externe.

---

## 4. Filtres disponibles

| Filtre | Composant | Effet SQL |
|--------|-----------|-----------|
| Comptes | `FilterBox` | `account_id IN (...)` |
| Catégories | `FilterBox` | `category_code IN (...)` |
| Période | `PeriodFilterButtons` (date-à-date + semaine/mois/année) | `date BETWEEN ? AND ?` |
| Recherche | `SearchBar` | `label LIKE %...%` |
| Exclusion X | Constante | `category_code != 'X'` dans KPI |
| Exclusion Y | Constante | Catégorie `Y` retirée des graphiques |

---

## 5. Composants principaux

| Composant | Fichier | Rôle |
|-----------|---------|------|
| `FilterBox` | `components/Dashboard/FilterBox.tsx` | Cases à cocher comptes/catégories |
| `SearchBar` | `components/Dashboard/SearchBar.tsx` | Champ recherche libellé |
| `PeriodFilterButtons` | `components/Dashboard/PeriodFilterButtons.tsx` | Presets semaine/mois/année |
| `DashboardViewTabs` | `components/Dashboard/DashboardViewTabs.tsx` | Bascule Résumé / Graphiques |
| `DashboardSummaryPanel` | `components/Dashboard/DashboardSummaryPanel.tsx` | KPI, encarts, rappels légaux |
| `DashboardChartsPanel` | `components/Dashboard/DashboardChartsPanel.tsx` | Graphiques paramétrables |
| `DashboardSettingsModal` | `components/Dashboard/DashboardSettingsModal.tsx` | Choix des widgets |
| `CategoryExpensesBarChart` | Barres dépenses par catégorie |
| `IncomePieChart` | Camembert revenus/dépenses |
| `AccountBalanceLineChart` | Courbe évolution soldes |
| `InvoiceVsPaymentChart` | Facturé vs encaissé |
| `DonationsByDonorChart` | Dons par donateur |

---

## 6. États vides et chargement

- Si aucune transaction : message avec lien vers `/upload`
- Indicateurs `isLoading` / `isFiltering` avec spinner `Loader2`
- Indicateur discret pendant le recalcul des filtres

---

## 7. Performance (améliorations vs Comptal2)

| Problème Comptal2 | Solution Comptal2.1 |
|-------------------|---------------------|
| Triple filtrage JS sur toutes les transactions | Une requête SQL par vue |
| Soldes O(n×comptes×périodes) | `balancesOverPeriod` en SQL cumulatif |
| Charts remontés à chaque render | Composants extraits + `useMemo` |

---

## 8. Voir aussi

- [Carte Dashboard](../cartes/dashboard.md) — fonctions et dépendances
- [Carte processus données](../carte-processus-donnees.md) — flux agrégats SQL
