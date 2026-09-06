# Guide de style — graphiques Comptal2.1

Référence visuelle pour Chart.js (canvas uniquement). L’interface (boutons, cartes, champs) reste sur les tokens `--invoicing-*` et les classes `ct-*`. Les séries de graphiques utilisent la palette pastel `--chart-pastel-*`.

## Tokens UI (`--invoicing-*`)

Définis dans `src/styles/variables.css`.

| Token | Clair | Sombre | Usage |
|---|---|---|---|
| `--invoicing-primary` | `#1e3a8a` | `#3b82f6` | CTA, onglet actif, titres d’accent |
| `--invoicing-primary-light` | `#3b82f6` | `#60a5fa` | hover, traits de courbe |
| `--invoicing-primary-lighter` | `#60a5fa` | `#93c5fd` | accents secondaires |
| `--invoicing-primary-lightest` | `#dbeafe` | `#1e3a8a` | focus ring, fond d’état actif |
| `--invoicing-gray-50` … `900` | `#f8fafc` → `#0f172a` | inversés | fonds, bordures, textes |
| `--invoicing-success` | `#10b981` | idem | KPI positif, crédits métier |
| `--invoicing-warning` | `#f59e0b` | idem | alertes |
| `--invoicing-danger` | `#ef4444` | idem | KPI négatif, débits métier |
| `--invoicing-info` | `#3b82f6` | idem | information |
| `--invoicing-surface` | `#ffffff` | `#1e293b` | cartes, conteneurs de graphiques |
| `--shadow-sm` … `--shadow-xl` | ombres douces | ombres plus denses | élévation |

Ne pas coder de couleurs UI en dur. Lire les variables CSS.

## Palette pastel des graphiques (`--chart-pastel-*`)

Huit tokens cycliques, lisibles en clair et un peu plus saturés en sombre.

| Token | Clair | Sombre | Rôle suggéré |
|---|---|---|---|
| `--chart-pastel-blue` | `#bfdbfe` | `#93c5fd` | solde, net, série principale |
| `--chart-pastel-green` | `#bbf7d0` | `#86efac` | crédits, encaissé |
| `--chart-pastel-red` | `#fecaca` | `#fca5a5` | débits, retard |
| `--chart-pastel-orange` | `#fed7aa` | `#fdba74` | avertissement, projection |
| `--chart-pastel-purple` | `#e9d5ff` | `#d8b4fe` | catégorie 4 |
| `--chart-pastel-yellow` | `#fef08a` | `#fde047` | catégorie 5 |
| `--chart-pastel-pink` | `#fbcfe8` | `#f9a8d4` | catégorie 6 |
| `--chart-pastel-teal` | `#99f6e4` | `#5eead4` | catégorie 7 |

Helper TypeScript : `src/utils/chartPastel.ts` (`chartPastelPalette()`, `chartPastelNamed()`). Toujours relire les tokens au rendu (changement de thème).

```ts
const palette = chartPastelPalette();
backgroundColor: slices.map((_, i) => palette[i % palette.length]);
```

Couleurs métier des comptes / catégories (Paramètres) restent valides pour Finance Global (Mensuel, Soldes, Bilan). La palette pastel s’applique surtout au Prévisionnel et aux nouveaux onglets Facturation / Dons / Contacts.

## Classes `ct-*`

Dans `src/styles/index.css` :

- `.ct-card` — surface, radius 12, padding 24, `shadow-sm`
- `.ct-btn-primary` / `.ct-btn-secondary` / `.ct-btn-danger` — min-height 44, radius 8
- `.ct-btn-icon` — bouton compact
- `.ct-input` / `.ct-select` / `.ct-label` — champs, focus ring `primary-lightest`
- `.ct-table` — tableau simple
- `.ct-section-title` / `.ct-hint` — titres et textes secondaires

Police : pile système (Apple / Segoe / Roboto). Pas de token spacing dédié : padding boutons `12×20`, gap `8`, radius `8` / `12`.

## Dark mode

1. Classe `.dark` (ou `html.dark`) posée par `applyThemeToDocument`.
2. Les tokens CSS changent automatiquement.
3. Les composants Chart.js relisent les couleurs au rendu via `useTheme()` puis `getComputedStyle(...)`.
4. Texte des axes : `--invoicing-gray-800` / `--invoicing-gray-500` selon le thème.
5. Grille : `rgba(148, 163, 184, 0.25)` clair, `0.18` sombre.
6. Tooltip : fond `rgba(255,255,255,0.96)` / `rgba(30,41,59,0.96)`.
7. Séparateurs doughnut : couleur de surface (`#ffffff` / `#1e293b`).

Ne pas observer le DOM au lieu de `useTheme` sauf besoin héritage (MutationObserver existant dans certains charts Finance).

## Convention montants

Transactions réelles (`StatsService`) :

- `debit ≤ 0`, `credit ≥ 0`
- dépenses = `SUM(-debit)`
- net = `debit + credit`

Prévisionnel (`ProjectionService`) :

- `totalDebits` négatif, `totalCredits` positif
- `netFlow = totalCredits + totalDebits`

Toujours afficher via `formatMoney()` (`src/utils/amounts.ts`). Les barres groupées de flux montrent souvent `|débit|` en positif rouge.

## Recettes Chart.js

### Barres empilées (série par catégorie)

```ts
{
  labels: periodLabels,
  datasets: categories.map((name, i) => ({
    type: 'bar',
    label: name,
    data: monthlyData[i],
    backgroundColor: categoryColors[name],
    stack: 'net',
  })),
}
```

`scales.x.stacked` et `scales.y.stacked` à `true`.

### Courbe aire (solde)

```ts
{
  labels,
  datasets: [{
    label: 'Solde',
    data: balances,
    borderColor: chartPastelNamed('blue'),
    backgroundColor: chartPastelNamed('blue'),
    fill: true,
    tension: 0.35,
  }],
}
```

### Doughnut avec séparateurs

`cutout: '58%'`. Insérer entre chaque part une tranche ~1,5 % du total, couleur = fond de surface, `borderWidth: 0` sur les séparateurs. Les ignorer dans le tooltip et la légende.

### Info-bulles

- Montant : `formatMoney(value)`
- Part : `(value / total * 100).toFixed(1) %`
- Solde prévisionnel : `Débit | Crédit | Net | Solde` sur la même bulle
- Catégorie / groupe : lister les lignes constitutives (8 max)

`interaction.mode = 'index'` pour les séries temporelles.
