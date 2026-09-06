# Carte — Page Upload

> Référence rapide : fonctions, services et composants propres à la page Upload.

---

## Identité

| Champ | Valeur |
|-------|--------|
| Route | `/upload` |
| Fichier page | `src/pages/Upload/Upload.tsx` |
| Type étapes | `UploadStepKey` (via `UploadStepper`) |

---

## Services utilisés

### ConfigService
| Méthode | Usage |
|---------|-------|
| `listAccounts()` | Liste comptes pour sélection |
| `createAccount(input)` | Création compte depuis modale |

### FileDetectionService
| Méthode | Usage |
|---------|-------|
| `detectFileType(file)` | Détecte csv / xlsx |
| `listSheets(file)` | Liste feuilles Excel |
| `analyzeFile(file, sheetName?)` | Parse structure fichier → `FileStructure` |

### ColumnMappingService
| Méthode | Usage |
|---------|-------|
| `analyzeFile(structure)` | Propose mapping colonnes → `FileAnalysisResult` |

### ImportService
| Méthode / fonction | Usage |
|--------------------|-------|
| `transformRows(...)` | Transforme lignes brutes → `PreviewRow[]` |
| `findOverlaps(accountId, start, end)` | Détecte imports chevauchants |
| `importRows({ accountId, rows, filename, ... })` | INSERT transactions + import |

### ImportTemplateService
| Méthode | Usage |
|---------|-------|
| `list()` | Templates sauvegardés |
| `create(input)` | Sauvegarde nouveau template |
| `remove(id)` | Supprime template |
| `findMatching(headers)` | Auto-sélection template par en-têtes |
| `rolesToHeaders(roles, columns)` | Conversion rôles → config template |

### Logger
| Méthode | Usage |
|---------|-------|
| `Logger.error(...)` | Erreurs opérations |

---

## Types importés

| Type | Fichier | Rôle |
|------|---------|------|
| `ColumnMappingConfig` | `types/import.ts` | Config mapping active |
| `ColumnRole` | `types/import.ts` | Rôle d'une colonne |
| `ExcelSheetInfo` | `types/import.ts` | Métadonnée feuille Excel |
| `FileAnalysisResult` | `types/import.ts` | Résultat analyse + structure |
| `ImportTemplate` | `types/import.ts` | Template sauvegardé |
| `OverlapWarning` | `types/import.ts` | Alerte chevauchement |
| `PreviewRow` | `types/import.ts` | Ligne aperçu avant import |
| `Account` | `types/models.ts` | Compte cible |

---

## Composants enfants

| Composant | Rôle |
|-----------|------|
| `UploadStepper` | Indicateur visuel étapes |
| `FileDropzone` | Glisser-déposer fichier |
| `TemplatePicker` | Sélection/suppression template |
| `ExcelSheetSelector` | Attribution feuille → compte |
| `ColumnMappingInterface` | UI mapping colonnes + solde initial |
| `ImportPreviewTable` | Aperçu lignes transformées |
| `ManualDataCreator` | Saisie manuelle |
| `CreateAccountModal` | Création compte |
| `SaveTemplateModal` | Nommage template |
| `ImportHelpModal` | Aide formats |
| `ConfirmModal` | Confirmation chevauchement |

---

## Étapes du wizard (`step`)

```
select → config → sheets → analyzing → mapping → preview → uploading → success/error
                                              ↘ manual ↗
```

---

## Fonctions internes de la page

| Fonction | Rôle |
|----------|------|
| `reloadAccounts()` | Rafraîchit liste comptes |
| `reloadTemplates()` | Rafraîchit templates |
| `analyzeAndMap(file, sheet?, accountId?)` | Pipeline analyse + mapping |
| `handleFileSelect(files)` | Point d'entrée fichier |
| `handleSheetContinue()` | Passe à l'analyse après sheets |
| `runImport()` | Vérifie chevauchements puis importe |
| `doImport()` | Appel `ImportService.importRows` |
| `handleCreateAccount(input)` | Crée compte + recharge liste |
| `handleSaveTemplate(name)` | Sauvegarde template courant |
| `handleDeleteTemplate(id)` | Supprime template |
| `handleTemplateSelect(id)` | Applique template sélectionné |
| `goToManual()` | Bascule saisie manuelle |

---

## Utils utilisés

| Util | Fonction |
|------|----------|
| `amounts.parseAmount` | Parse montants saisis |

---

## Tables SQLite écrites

| Table | Opération |
|-------|-----------|
| `imports` | INSERT (métadonnées import) |
| `transactions` | INSERT (lignes importées) |
| `import_templates` | INSERT/DELETE (templates) |
| `accounts` | INSERT (création compte à la volée) |

---

## Schéma d'appel import

```
Upload.tsx
  ├── FileDetectionService.analyzeFile()
  ├── ColumnMappingService.analyzeFile()
  ├── transformRows()                    [ImportService]
  ├── ImportService.findOverlaps()
  └── ImportService.importRows()
        └── Db.inTransaction()
              ├── INSERT imports
              └── INSERT transactions (batch)
```

---

## Fichiers CSS associés

- `src/styles/upload-custom.css`
