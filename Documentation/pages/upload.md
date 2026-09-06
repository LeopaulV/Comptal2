# Page Upload (Import) — Fonctionnement

**Route** : `#/upload`  
**Fichier** : `src/pages/Upload/Upload.tsx`  
**Plan** : 2 — Upload (réalisé)

---

## 1. Rôle

La page Upload permet d'importer des relevés bancaires au format **CSV** ou **Excel (XLSX)**, ou de saisir des transactions **manuellement**. Le wizard guide l'utilisateur de la sélection du fichier jusqu'à l'insertion en base SQLite. Contrairement à Comptal2, la sortie n'est plus un fichier CSV mais des **INSERT SQL** dans `transactions` et `imports`.

---

## 2. Étapes du wizard

| Étape (`step`) | Description | Composant clé |
|----------------|-------------|---------------|
| `select` | Choix fichier ou saisie manuelle | `FileDropzone`, `TemplatePicker` |
| `config` | Sélection compte cible + solde initial | Formulaire inline |
| `sheets` | Attribution feuilles Excel → comptes | `ExcelSheetSelector` |
| `analyzing` | Analyse en cours | Spinner |
| `mapping` | Attribution rôles aux colonnes | `ColumnMappingInterface` |
| `preview` | Aperçu lignes transformées | `ImportPreviewTable` |
| `manual` | Création manuelle de lignes | `ManualDataCreator` |
| `uploading` | Import en cours | Spinner |
| `success` / `error` | Résultat final | Messages + compteur |

Le stepper visuel est géré par `UploadStepper`.

---

## 3. Flux détaillé d'import fichier

```
1. Utilisateur dépose un fichier (FileDropzone)
2. FileDetectionService.detectFileType() → csv | xlsx
3a. CSV → analyzeAndMap(file)
3b. XLSX → FileDetectionService.listSheets() → étape sheets
4. FileDetectionService.analyzeFile(file, sheetName)
5. ColumnMappingService.analyzeFile(structure) → mapping proposé
6. ImportTemplateService.findMatching(headers) → template auto si correspondance
7. Utilisateur ajuste mapping (ColumnMappingInterface)
8. transformRows() → PreviewRow[]
9. ImportService.findOverlaps() → alerte si période déjà importée
10. ImportService.importRows() → INSERT SQLite
11. (Excel multi-feuilles) → feuille suivante ou success
```

---

## 4. Mapping des colonnes

Rôles possibles (`ColumnRole`) :
- `date` — date d'opération
- `dateValue` — date de valeur (optionnel)
- `libelle` — libellé
- `debit` / `credit` — montants séparés
- `debitCredit` — débit/crédit combiné dans une colonne signée
- `balance` — solde après opération
- `ignore` — colonne ignorée

`ColumnMappingService` propose un mapping automatique par heuristiques sur les en-têtes.
`mappingFromRoles()` exige une date, un libellé et au moins un montant. Pour `debitCredit`, le même
index alimente débit et crédit, puis `transformRows()` sépare la valeur selon son signe.

---

## 5. Templates d'import

- Sauvegarde du mapping via `SaveTemplateModal` → `ImportTemplateService.create()`
- Sélection d'un template existant via `TemplatePicker`
- Stockage en table `import_templates` (schéma v3)
- Correspondance automatique par en-têtes : `ImportTemplateService.findMatching()`

---

## 6. Gestion des comptes

- Liste des comptes : `ConfigService.listAccounts()`
- Création à la volée : `CreateAccountModal` → `ConfigService.createAccount()`
- Chaque import est lié à un `account_id` et enregistre une ligne dans `imports`

---

## 7. Détection de chevauchements

Avant import, `ImportService.findOverlaps(accountId, dateStart, dateEnd)` vérifie si une période similaire existe déjà pour ce compte. Si oui, `ConfirmModal` demande confirmation à l'utilisateur.

---

## 8. Saisie manuelle

L'étape `manual` permet de créer des transactions sans fichier via `ManualDataCreator`. Les lignes passent par le même pipeline `transformRows` + `importRows`.

---

## 9. Modales auxiliaires

| Modale | Rôle |
|--------|------|
| `CreateAccountModal` | Créer un compte pendant l'import |
| `SaveTemplateModal` | Nommer et sauvegarder un template |
| `ImportHelpModal` | Aide sur les formats acceptés |
| `ConfirmModal` | Confirmation chevauchement / actions destructives |

---

## 10. Particularités

- **Pas d'auto-catégorisation à l'import** : les catégories sont assignées ensuite dans Édition
- **Multi-feuilles Excel** : chaque feuille peut être mappée à un compte différent
- **Solde initial** : paramétrable à l'étape config, utilisé pour recalcul si colonne solde présente

---

## 11. Voir aussi

- [Carte Upload](../cartes/upload.md)
- [Carte processus données](../carte-processus-donnees.md) — flux INSERT
