# Carte — Page Dashboard

> Référence rapide : fonctions, services et composants propres à la page Dashboard.

---

## Identité

| Champ | Valeur |
|-------|--------|
| Route | `/dashboard` |
| Fichier page | `src/pages/Dashboard/Dashboard.tsx` |
| Vues | `summary` \| `charts` |

---

## Services utilisés

### ConfigService
| Méthode | Usage dans la page |
|---------|-------------------|
| `listAccounts()` | Chargement initial — liste comptes pour filtres |
| `listCategories()` | Chargement initial — liste catégories pour filtres |

### StatsService
| Méthode | Usage dans la page |
|---------|-------------------|
| `dateBounds()` | Bornes min/max dates transactions |
| `distinctPeriods()` | Options semaine/mois/année dérivées des données |
| `kpis(filters)` | KPI résumé (revenus, dépenses, net, count, max, moyenne) |
| `categoryTotals(chartFilters)` | Totaux par catégorie pour graphiques |
| `accountBalancesAt(dateEnd, accountIds)` | Soldes comptes à la date de fin |
| `balancesOverPeriod(dateStart, dateEnd, gran, accountIds)` | Séries courbe soldes |
| `autoGranularity(dateStart, dateEnd)` | Granularité automatique courbes |

### ExportService
| Méthode | Usage dans la page |
|---------|-------------------|
| `exportTransactionsCsv(filters)` | Export CSV via dialog |

### DashboardInsightsService
| Méthode | Usage dans la page |
|---------|-------------------|
| `load({ filters, granularity, … })` | Insights facturation, dons, contacts et rappels légaux |

### DashboardSettingsService
| Méthode | Usage |
|---------|-------|
| `load(context)` | Widgets résumé/graphiques visibles |
| `save(settings)` | Persistance via `dashboard_settings` |

### SettingsService / EmetteurService
| Méthode | Usage |
|---------|-------|
| `SettingsService.current` | Visibilité menus (contexte des widgets) |
| `EmetteurService.isEmetteurConfigured()` | Contexte légal / facturation |

---

## Types importés (StatsService)

| Type | Rôle |
|------|------|
| `StatsFilters` | Objet filtres passé aux requêtes |
| `KpiStats` | Structure KPI |
| `CategoryTotal` | Total par catégorie |
| `AccountBalance` | Solde par compte |

---

## Composants enfants

| Composant | Props / rôle clé |
|-----------|------------------|
| `FilterBox` | `items`, `onToggle`, `onToggleAll` |
| `SearchBar` | `value`, `onChange` |
| `PeriodFilterButtons` | dates min/max, sélection date-à-date/semaine/mois/année |
| `DashboardViewTabs` | `activeTab`, `onChange` — `summary` \| `charts` |
| `DashboardSummaryPanel` | KPI, mini-cartes, encarts facturation/dons/contacts, rappels |
| `DashboardChartsPanel` | Barres, camembert, soldes, facture vs paiement, dons, aging |
| `DashboardSettingsModal` | Réglage des widgets du résumé et des graphiques |

Graphiques enfants : `CategoryExpensesBarChart`, `IncomePieChart`, `AccountBalanceLineChart`,
`InvoiceVsPaymentChart`, `InvoiceAgingChart`, `DonationsByDonorChart`.
Encarts résumé : `MiniCategoryCards`, `TopCategoriesList`, `DashboardLegalReminders`.

---

## États React principaux

| État | Type | Rôle |
|------|------|------|
| `accounts` | `Account[]` | Référentiel comptes |
| `categories` | `Category[]` | Référentiel catégories |
| `dateStart` / `dateEnd` | `string` | Plage filtrée |
| `selectedAccounts` | `Set<string>` | Codes comptes cochés |
| `selectedCategories` | `Set<string>` | Codes catégories cochés |
| `search` | `string` | Recherche libellé |
| `activeTab` | `DashboardViewTab` | Onglet résumé/graphiques |
| `kpis` | `KpiStats` | Indicateurs |
| `catTotals` | `CategoryTotal[]` | Données graphiques catégories |
| `accBalances` | `AccountBalance[]` | Soldes mini-cartes |
| `lineLabels` / `lineSeries` | séries Chart.js | Courbe soldes |
| `granularity` | `ChartGranularity` | Résolution de la courbe des soldes |

---

## Fonctions internes de la page

| Fonction | Rôle |
|----------|------|
| `handlePeriodChange()` | Synchronise les dates choisies |
| `load()` | KPI, catégories, soldes, séries et insights |
| `handleExport()` | Déclenche export CSV |
| `openSettings()` / `saveSettings()` | Modale de widgets |
| `toggleAccount()` / `toggleAllAccounts()` | Filtres comptes |
| `toggleCategory()` / `toggleAllCategories()` | Filtres catégories |

---

## Utils utilisés

| Util | Fonction |
|------|----------|
| `dateFormats.toIsoDate` | Conversion dates ISO |
| `date-fns` | `format`, `parseISO`, `subDays`, `subMonths`, `subYears`, `differenceInMonths` |

---

## Dépendances externes

| Lib | Usage |
|-----|-------|
| `react-router-dom` | `Link` vers `/upload` |
| `react-i18next` | Traductions |
| `react-toastify` | Toasts erreur export |
| `lucide-react` | Icônes UI |

---

## Schéma d'appel

```
Dashboard.tsx
├── load / handlePeriodChange / handleExport / saveSettings
├── FilterBox / SearchBar / PeriodFilterButtons / DashboardViewTabs
├── DashboardSummaryPanel → MiniCategoryCards, TopCategoriesList, DashboardLegalReminders
├── DashboardChartsPanel → barres, camembert, soldes, factures, dons
├── DashboardSettingsModal
├── ConfigService.listAccounts / listCategories
├── StatsService.dateBounds / distinctPeriods / kpis / categoryTotals / accountBalancesAt / balancesOverPeriod
├── DashboardInsightsService.load
├── DashboardSettingsService.load / save
└── ExportService.exportTransactionsCsv
```

---

## Fichiers CSS associés

- `src/styles/dashboard-custom.css`
