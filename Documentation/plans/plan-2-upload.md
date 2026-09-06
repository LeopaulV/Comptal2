# Plan 2 — Page Upload (import de relevés bancaires)

**Statut : RÉALISÉ** (parité visuelle/UX Comptal2 + templates d’import, schéma SQLite v3)

## Objectif

Recréer le wizard d'import de Comptal2 (CSV / XLSX / XLS + création manuelle) avec pour destination la base SQLite du profil actif, et un rendu esthétique aligné sur Comptal2 (stepper, dropzone, états feedback, mapping par rôles).

## Référence Comptal2 (lecture seule)

- Page : `Comptal2/src/renderer/pages/Upload/Upload.tsx`
- Composants : `Comptal2/src/renderer/components/Upload/` — `FileDropzone`, `ExcelSheetSelector`, `ColumnMappingInterface`, `ImportPreviewTable`, `ManualDataCreator`, `CreateAccountModal`, `ImportHelpModal`
- Services : `FileDetectionService`, `ColumnMappingService`, `CSVTransformService`, `ExcelSheetService`, `BalanceService`

## Flux implémenté

Étapes : `select` | `config` | `sheets` | `analyzing` | `mapping` | `preview` | `manual` | `uploading` | `success` | `error`

1. **select** : dropzone dashed + séparateur « ou » + saisie manuelle ; encart formats ; lien aide (`ImportHelpModal`) ; barre templates.
2. **CSV** : config compte (carte dédiée + créer compte) → analyzing → mapping (rôles) → preview → uploading → success/error.
3. **Excel** : feuilles → compte par feuille → analyzing feuille par feuille → mapping → preview → import multi-feuilles.
4. **Manuel** : saisie de lignes → preview → import.

### Mapping de colonnes (rôles par colonne)

- UI : 1 select de rôle par colonne (`date` / `dateValue` / `libelle` / `debit` / `credit` / `debitCredit` / `balance` / `ignore`) + aperçu 5 lignes + pastilles couleur + solde initial.
- Conversion vers `ColumnMappingConfig` via `mappingFromRoles` (`debitCredit` = même index débit/crédit).
- Heuristiques auto conservées (dates, libellé texte long, montants, solde monotone).

### Templates d’importation (schéma v3)

Table `import_templates` dans `comptal.db` du profil :

| Colonne | Rôle |
|---|---|
| `name` | Libellé (ex. « CA — relevé mensuel ») |
| `account_id` | FK `accounts` (nullable) |
| `initial_balance` | Solde initial (nullable → reprendre le compte) |
| `column_roles_json` | Mapping **par nom d’en-tête** → rôle |
| `created_at` / `updated_at` | Horodatage |

Service : `ImportTemplateService` (`list` / `create` / `update` / `remove` / `findMatching` / `applyToColumns` / `rolesToHeaders`), tout via `withLog`.

Application : suggestion auto si les en-têtes requis matchent ; sauvegarde depuis l’étape mapping (`SaveTemplateModal`).

## Différences avec Comptal2 (SQLite)

- Sortie : `INSERT INTO transactions` par lots de 100 dans `Db.inTransaction`, + 1 ligne `imports`.
- Dates ISO `yyyy-MM-dd` ; débits ≤ 0, crédits ≥ 0 ; montants FR normalisés.
- Solde initial : `accounts.initial_balance` (pas de `solde_compte.json`).
- Overlap : ConfirmModal si période déjà importée.
- Pas d’auto-catégorisation à l’import.

## Structure livrée

- `src/pages/Upload/Upload.tsx` — machine à étapes + stepper
- `src/components/Upload/` — FileDropzone, UploadStepper, ColumnMappingInterface, ImportPreviewTable, ExcelSheetSelector, ManualDataCreator, CreateAccountModal, ImportHelpModal, SaveTemplateModal, TemplatePicker
- `src/services/ImportService.ts` / `ImportTemplateService.ts`
- `src/types/import.ts` — `ColumnRole`, `ImportTemplate`, `mappingFromRoles`
- `src/styles/upload-custom.css` — `.upload-stepper`, `.upload-dropzone`, `.upload-info-banner`, `.upload-status-icon` (+ dark mode)
- i18n : clés `upload.*` et `columnMapping.*` (fr/en)

## Polish esthétique (parité Comptal2)

- En-tête titre `text-3xl` + sous-titre ; conteneur `max-w-6xl mx-auto`
- Stepper horizontal (cercles numérotés actif/passé/futur)
- Cartes `ct-card` ; dropzone dashed large ; bandeaux info/warn/error
- États analyzing/uploading (`Loader2`), success (`CheckCircle`), error (`AlertTriangle` + retry)
- Charte : variables `--invoicing-*`, classes `ct-*`, icônes lucide uniquement

## Validation

- `npm run typecheck` OK
- `npm run tauri:dev` : parcours CSV/Excel ; sauver/réappliquer un template ; logs JSONL `ImportTemplateService.*` / `ImportService.*`
- Visuel : comparer step by step avec Comptal2 (clair / sombre)
