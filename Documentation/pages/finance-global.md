# Page Finance globale — Fonctionnement

**Route** : `#/finance-global`  
**Fichier** : `src/pages/FinanceGlobal/FinanceGlobal.tsx`  
**Plan** : 5 — Finance (réalisé)

---

## 1. Rôle

La page Finance globale propose une analyse temporelle des finances, une comparaison
prévisionnel vs réel, un bilan, et des vues Facturation / Dons / Contacts. Le catalogue
d’onglets est `FINANCE_TAB_CATALOG` ; visibilité et ordre sont persistés par
`FinanceSettingsService`.

---

## 2. Structure de l'interface

```
┌──────────────────────────────────────────┬───────────────────┐
│  Titre + onglets                         │ Sidebar droite     │
│  [ Mensuel | Solde | Projection | Bilan | Facturation | Dons | Contacts ]│ Granularité       │
│                                          │ Comptes           │
│  Graphique + FinanceTable                │ Catégories        │
│                                          │ Période           │
└──────────────────────────────────────────┴───────────────────┘
```

---

## 3. Onglets

### 3.1 Mensuel (`monthly`)
- **Graphique** : `MonthlyChart` — barres empilées par catégorie et par période
- **Données** : `StatsService.categoryByPeriod(filters, granularity)`
- **Tableau** : `FinanceTable` avec totaux par période

### 3.2 Solde (`balance`)
- **Graphique** : `BalanceChart` — courbes empilées des soldes par compte
- **Données** : `StatsService.balancesOverPeriod(dateStart, dateEnd, granularity, accountIds)`
- **Tableau** : soldes par compte et par période

### 3.3 Projection vs Réalité (`projection`)
- **Composant** : `ProjectionVsReality` + `ProjectionVsRealityChart`
- **Réalité** : `StatsService.categoryByPeriod()` sur transactions réelles
- **Projection** : `ProjectionService.calculateByCategory()` à partir des abonnements du projet
- **CRUD projet** : création projet minimal via `ProjectService`
- Tables SQL : `projects`, `project_subscriptions` (schéma v2)

### 3.4 Bilan (`bilan`)
- **Composant** : `BilanTab` + `BilanCharts`
- **Données** : `StatsService.bilanByPeriod(filters, granularity)`
- Affiche crédits et débits par catégorie avec récapitulatif

### 3.5 Facturation / Dons / Contacts
- **Composants** : `FacturationTab`, `DonsTab`, `ContactsTab`
- **Données** : `DashboardInsightsService.load()` (mêmes agrégats que le résumé Dashboard)

---

## 4. Filtres communs

| Paramètre | Composant | Effet |
|-----------|-----------|-------|
| Date-à-date / semaine / mois / année | `PeriodFilterButtons` dans la sidebar droite | Plage `date BETWEEN` |
| Granularité | `ChartGranularityZoom` | Regroupement SQL et axe X |
| Comptes | Cases à cocher | `account_id IN` |
| Catégories | Cases à cocher | `category_code IN` (hors `X`) |

`autoGranularity()` ajuste la granularité par défaut selon l'amplitude de la plage.

---

## 5. Chargement des données

### Initialisation
```typescript
ConfigService.listAccounts()
ConfigService.listCategories()
StatsService.dateBounds()
StatsService.kpis({ excludeCategories: ['X'] })  // détecte données vides
```

### Rechargement (onglets Mensuel/Solde)
```typescript
StatsService.categoryByPeriod(filters, granularity)
StatsService.balancesOverPeriod(...)
StatsService.categorySummaries(filters)
StatsService.accountSummaries(filters)
```

### Onglet Bilan (chargement différé)
`StatsService.bilanByPeriod(buildFilters(), granularity)` — déclenché à l'activation de l'onglet.

### Onglet Projection
Géré dans `ProjectionVsReality.tsx` :
1. `ProjectService.list()` — liste des projets
2. `ProjectService.listSubscriptions(projectId)` — abonnements
3. `ProjectionService.calculateByCategory(project, subs, granularity, range)` — points projetés

---

## 6. Composants

| Composant | Fichier | Onglet |
|-----------|---------|--------|
| `ChartTabs` | `components/FinanceGlobal/ChartTabs.tsx` | Navigation |
| `FinanceToolbar` | `components/FinanceGlobal/FinanceToolbar.tsx` | Filtres |
| `MonthlyChart` | `components/FinanceGlobal/MonthlyChart.tsx` | Mensuel |
| `BalanceChart` | `components/FinanceGlobal/BalanceChart.tsx` | Solde |
| `ProjectionVsReality` | `components/FinanceGlobal/ProjectionVsReality.tsx` | Projection |
| `ProjectionVsRealityChart` | `components/FinanceGlobal/ProjectionVsRealityChart.tsx` | Projection |
| `BilanTab` | `components/FinanceGlobal/BilanTab.tsx` | Bilan |
| `BilanCharts` | `components/FinanceGlobal/BilanCharts.tsx` | Bilan |
| `FacturationTab` | `components/FinanceGlobal/FacturationTab.tsx` | Facturation |
| `DonsTab` | `components/FinanceGlobal/DonsTab.tsx` | Dons |
| `ContactsTab` | `components/FinanceGlobal/ContactsTab.tsx` | Contacts |
| `FinanceChartConfigModal` | `components/FinanceGlobal/FinanceChartConfigModal.tsx` | Visibilité des onglets |
| `FinanceTable` | `components/FinanceGlobal/FinanceTable.tsx` | Tous (tableau sticky) |

---

## 7. Granularité temporelle

Type `ChartGranularity` : `'day' | 'week' | 'month' | 'quarter' | 'semester' | 'year'`

La fonction `strftimeExpr(granularity, column)` dans `StatsService` génère l'expression SQL de regroupement temporel.

Labels d'affichage via `getPeriodLabel()` et tri via `sortPeriodKeys()` (`utils/periodKeys.ts`).

---

## 8. État vide

Si `kpis.count === 0` : message invitant à importer des données via `/upload`.

---

## 9. Voir aussi

- [Carte Finance](../cartes/finance-global.md)
- [Carte processus données](../carte-processus-donnees.md)
- [Page Prévisionnel](./previsionnel.md) — gestion complète des prévisions
