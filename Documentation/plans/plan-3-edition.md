# Plan 3 — Page Edition (édition des transactions)

**Statut : RÉALISÉ**

## Objectif

Recréer l'éditeur de transactions de Comptal2 au-dessus de SQLite : filtres et tri en SQL, édition inline par `id` stable, auto-catégorisation statistique, nettoyage des doublons.

## Référence Comptal2 (lecture seule)

- Page : `Comptal2/src/renderer/pages/Edition/Edition.tsx`
- Tableau : `Comptal2/src/renderer/components/Edition/CsvEditorTable.tsx` (~1800 lignes — NE PAS porter tel quel, s'en inspirer)
- Panneaux : `SourceFilterPanel`, `CategoryFilterPanel`, `PeriodFilterPanel`, `AutoCategorisationReviewModal`, `CleanDuplicatesModal`, `CategoryLegendPanel`
- Services : `EditionService`, `AutoCategorisationService`
- Styles : `edition-custom.css` (référence charte pour boutons d'action et onglets de filtres)

## Fonctionnalités à implémenter

| Fonction | Implémentation SQLite |
|----------|----------------------|
| Filtres compte / catégorie / non-catégorisées / période | `WHERE account_id IN (…) AND category_code … AND date BETWEEN …` |
| Recherche texte (debounce 300 ms) | `WHERE label LIKE '%…%' COLLATE NOCASE` |
| Tri par colonne (asc/desc/off) | `ORDER BY` dynamique |
| Édition inline (date, libellé, montants, catégorie) | `UPDATE transactions SET … WHERE id = ?` (updated_at) |
| Autocomplete catégorie | codes + noms depuis `categories` |
| Insertion / suppression de lignes | `INSERT` / `DELETE … WHERE id = ?` avec ConfirmModal |
| Doublons | `GROUP BY account_id, date, debit, credit, label HAVING COUNT(*) > 1` + modale de revue |
| Légende catégories (CRUD couleurs) | réutiliser `ConfigService` |

## Auto-catégorisation (portage de l'algorithme Comptal2)

- Apprentissage par mots du libellé : tokenisation espace/`-`/`_`, ignorer les tokens numériques, pondération des mots courts.
- Stockage dans la table `autocat_stats (word, category_code, count)` — mise à jour à chaque catégorisation manuelle confirmée.
- Suggestion : score = somme des P(catégorie|mot), seuil min ~0,1 ; bouton « baguette magique » → suggestions sur les lignes visibles non catégorisées → modale de revue → UPDATE en lot.

## Performance (leçons de Comptal2)

- **Pagination SQL** (LIMIT/OFFSET ou keyset) + virtualisation de l'affichage au-delà de ~500 lignes visibles.
- Pas de « tout charger en mémoire » : le tableau interroge SQL à chaque changement de filtre (les index couvrent date/compte/catégorie).
- Clé d'identité = `transactions.id` (plus de clé fragile `Source|rowIndex|Date|Libellé`).
- Sauvegarde unitaire par `UPDATE` (plus de réécriture de fichiers entiers).

## Structure cible

- `src/pages/Edition/Edition.tsx`
- `src/components/Edition/…` (table, panneaux de filtres, modales)
- `src/services/EditionService.ts` (requêtes) + `src/services/AutoCategorisationService.ts`
- `src/styles/edition-custom.css` (reprendre la référence visuelle de Comptal2)

## Validation

- Éditer/catégoriser des transactions migrées, vérifier la persistance SQL et les logs JSONL.
- Tester avec > 5 000 lignes : le changement de filtre doit rester < 100 ms.
