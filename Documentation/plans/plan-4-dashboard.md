# Plan 4 — Page Dashboard (refonte performance)

**Statut : RÉALISÉ**

## Objectif

Refaire le Dashboard de Comptal2 (jugé très lent) en conservant ses composants ergonomiques, avec toutes les agrégations en SQL.

## Référence Comptal2 (lecture seule)

- Page : `Comptal2/src/renderer/pages/Dashboard/Dashboard.tsx`
- **Composants à conserver** (identifiés fonctionnels et bien conçus) :
  `FilterBox` (checkboxes comptes/catégories), `SearchBar` (debounce), `PeriodFilterButtons` (semaine/mois/année), `MiniAccountCards`, `MiniCategoryCards`, `DateRangeSlider` (Common), `AccountBalanceLineChart` (Chart.js, le mieux écrit).
- **À ne PAS reprendre** : `WealthChart` / `CategoryPieChart` (Recharts, morts), `SortableTable` sans virtualisation, `RecentTransactions`, `StatsCard`, `AccountCard` (non branchés).

## Causes de lenteur de Comptal2 → corrections par conception

| Problème Comptal2 | Correction Comptal2.1 |
|---|---|
| `filterTransactionsAdvanced` refiltre 3× (filtre + stats + catégories) | 1 seule requête SQL par bloc, exécutées en parallèle |
| `getAccountBalancesOverPeriod` : O(comptes × périodes × transactions) avec `.filter` par période | somme cumulée SQL : `SUM(debit+credit) OVER (PARTITION BY account_id ORDER BY date)` échantillonnée par période |
| Tableau rend TOUTES les lignes en DOM + `key` qui force le remount | tableau paginé (50/100 lignes) ou virtualisé |
| `CollapsibleSection` défini DANS le composant page (remount des charts à chaque render) | composant extrait dans `components/Dashboard/` |
| Camemberts sans `useMemo`, aucun `React.memo` | mémoïsation systématique des données/options Chart.js, `React.memo` sur les cartes |
| `Math.min(...spread)` sur tout le tableau pour min/max dates | `SELECT MIN(date), MAX(date) FROM transactions` |

## Contenu de la page (parité visuelle Comptal2)

1. Sidebar filtres : comptes (FilterBox), catégories (FilterBox), recherche (SearchBar), période (PeriodFilterButtons + DateRangeSlider).
2. KPI : solde net, total dépenses, total revenus (exclure catégorie `X` comme Comptal2).
3. Graphiques Chart.js : camembert dépenses par catégorie (exclure `X`/`Y` à l'affichage), camembert revenus vs dépenses, courbes d'évolution des soldes par compte (granularité auto jour/semaine/mois selon la durée).
4. Mini-cartes : soldes par compte (+ total), moyennes mensuelles par catégorie.
5. Tableau des transactions filtrées (paginé/virtualisé, tri par colonne).

## Requêtes SQL type

- Stats : `SELECT SUM(credit) AS income, SUM(-debit) AS expenses FROM transactions WHERE … AND category_code IS NOT 'X'`
- Camembert : `SELECT category_code, SUM(debit+credit) AS net FROM transactions WHERE … GROUP BY category_code`
- Soldes par compte à une date : solde initial + `SUM(debit+credit)` jusqu'à la date.
- Séries de soldes : CTE générant les bornes de périodes, puis cumul par compte.

## Structure cible

- `src/pages/Dashboard/Dashboard.tsx` (orchestration fine, état minimal)
- `src/components/Dashboard/…` (composants portés + CollapsibleSection extrait)
- `src/services/StatsService.ts` (toutes les requêtes d'agrégats, réutilisé par Finance)
- `src/styles/dashboard-custom.css`

## Validation

- Profil migré avec plusieurs milliers de transactions : changement de filtre fluide (< 100 ms de requêtes, vérifiable dans les logs `(perf)`).
- Aucun composant Recharts. Zéro recalcul JS sur tableau complet.
