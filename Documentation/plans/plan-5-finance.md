# Plan 5 — Page Finance (Finance Globale)

**Statut : RÉALISÉ**

## Objectif

Recréer la page Finance Globale de Comptal2 : 4 onglets d'analyse avec granularité jour→année et plage de dates, alimentés par agrégats SQL.

## Référence Comptal2 (lecture seule)

- Page : `Comptal2/src/renderer/pages/FinanceGlobal/FinanceGlobal.tsx` (~1040 lignes)
- Composants : `Comptal2/src/renderer/components/FinanceGlobal/` (ignorer les morts : `StatsGrid`, `TrendChart`, `ComparisonChart`, `RecurringExpenses`)
- Services : `DataService.getCategoryChartData` / `getAccountChartData` / `getBilanChartData`, `ProjectionService.calculateProjection`
- Styles : `finance-global-custom.css`
- Bugs connus à NE PAS reproduire : overlays `::before/::after` des tableaux à colonnes fixes (voir `Comptal2/.cursor/rules/bugs-solutions.mdc` Bug 2) → utiliser `position: sticky` sur les colonnes fixes.

## Les 4 onglets

1. **Graphique Mensuel** : barres (Chart.js) des montants nets par catégorie et par période ; granularité jour/semaine/mois/trimestre/année ; tableau des valeurs sous le graphique.
2. **Graphique Solde** : évolution du solde par compte (empilé), mêmes contrôles de période.
3. **Projection contre Réalité** : compare un projet de projection aux transactions réelles par catégorie. Nécessite le portage de `ProjectionService` (abonnements/postes récurrents → série projetée) et le stockage des projets de projection (table `projects` à ajouter en migration v2 du schéma, ou JSON `data/parameter/projects.json` du profil — choisir la table SQL).
4. **Bilan** : crédits/débits par catégorie sur la période + tableau récapitulatif (totaux par type).

## Barre d'outils commune

- Sélecteur de granularité (jour → année), plage de dates (DateRangeSlider réutilisé), sélection de comptes/catégories.
- Les requêtes réutilisent `StatsService` (Plan 4) : `GROUP BY période, catégorie` avec `strftime` selon la granularité.

## Structure cible

- `src/pages/FinanceGlobal/FinanceGlobal.tsx` (onglets + toolbar)
- `src/components/FinanceGlobal/…` (1 composant par onglet + tableaux)
- `src/services/ProjectionService.ts` (portage), extension de `StatsService`
- `src/styles/finance-global-custom.css` (sticky columns, pas d'overlay)
- Migration schéma v2 : table `projects` (projets de projection) si l'onglet 3 est retenu dans cette itération.

## Validation

- Comparer visuellement chaque onglet avec Comptal2 sur les mêmes données migrées.
- Vérifier les logs `(perf)` : requêtes < 100 ms sur plusieurs milliers de lignes.
- Tableaux : colonnes fixes en `position: sticky`, aucun bloc blanc recouvrant les données (Bug 2 de Comptal2).
