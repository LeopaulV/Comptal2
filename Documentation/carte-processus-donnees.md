# Carte des processus de données — Comptal2.1

Ce document décrit comment les données circulent dans Comptal2.1 : du démarrage à la persistance, en passant par l'import, l'édition et les agrégats.

---

## 1. Vue globale

```mermaid
flowchart TB
    subgraph boot [Démarrage]
        L[Logger.init]
        S[SettingsService.load]
        P[ProfileService.ensureInitialized]
        D[Db.openForProfile]
        L --> S --> P --> D
    end

    subgraph persist [Persistance]
        JSON[settings.json + info.json]
        SQL[(comptal.db)]
        LOGS[logs JSONL]
        FS[tauriBridge FS/ZIP]
    end

    subgraph sources [Entrées de données]
        CSV[Relevé CSV/Excel]
        MAN[Saisie manuelle]
        MIG[Migration Comptal2]
        UI[Édition utilisateur]
    end

    subgraph pages [Pages consommatrices]
        UP[Upload]
        ED[Edition]
        DASH[Dashboard]
        FIN[Finance]
        PREV[Prévisionnel]
        CONTACT[Contacts]
        INV[Facturation]
        ASSO[Association]
        PARAM[Paramètres]
    end

    boot --> pages
    S --> JSON
    P --> JSON
    P --> FS
    D --> SQL
    L --> LOGS

    CSV --> UP
    MAN --> UP
    MIG --> PARAM
    UP -->|INSERT| SQL
    ED -->|UPDATE/DELETE/INSERT| SQL
    UI --> ED
    PARAM -->|CRUD config| SQL
    PARAM --> FS

    SQL -->|agrégats SELECT| DASH
    SQL -->|agrégats SELECT| FIN
    PREV <-->|CRUD prévisions| SQL
    CONTACT <-->|payloads contacts| SQL
    INV <-->|payloads documents| SQL
    ASSO <-->|dons et reçus| SQL
    DASH -->|export CSV| FS
```

---

## 2. Processus de démarrage

| Étape | Composant | Action | Fichiers touchés |
|-------|-----------|--------|------------------|
| 1 | `Logger.init()` | Génère `sessionId`, récupère `dataRoot` via `get_session_info` | `data/logs/{sessionId}_app.jsonl` |
| 2 | `SettingsService.load()` | Lit ou crée les paramètres globaux | `data/parameter/settings.json` |
| 3 | `applyThemeToDocument()` | Applique le thème CSS | — |
| 4 | `i18n.changeLanguage()` | Charge la langue | — |
| 5 | `WindowService.apply()` | Applique dimensions fenêtre | — |
| 6 | `ProfileService.ensureInitialized()` | Charge/crée profil actif | `data/profils/{id}/info.json` |
| 7 | `Db.openForProfile(id)` | Ouvre SQLite, réparation/migrations jusqu’à v7 | `data/profils/{id}/comptal.db` |

**Changement de profil** (Paramètres → Profils) :
1. `ProfileService.setActive(newId)`
2. `SettingsService.save({ activeProfileId })`
3. `Db.close()` puis `Db.openForProfile(newId)`
4. `profileEpoch++` dans Paramètres pour remonter les onglets liés aux données

---

## 3. Modèle de données SQLite

### Relations principales

```mermaid
erDiagram
    accounts ||--o{ transactions : "account_id"
    accounts ||--o{ imports : "account_id"
    imports ||--o{ transactions : "import_id"
    categories ||--o{ transactions : "category_code"
    projects ||--o{ project_subscriptions : "project_id"
    accounts ||--o{ import_templates : "account_id"
    clients ||--o{ devis : "client_id logique"
    clients ||--o{ factures : "client_id logique"
    devis ||--o{ factures : "devis_origine logique"
    donateurs ||--o{ dons_manuels : "donateur_id logique"
    donateurs ||--o{ donateur_transactions : "donateur_id logique"

    accounts {
        int id PK
        string code UK
        string name
        string color
        real initial_balance
    }

    categories {
        int id PK
        string code UK
        string name
        string color
    }

    transactions {
        int id PK
        int account_id FK
        string date
        string value_date
        real debit
        real credit
        string label
        string category_code
        int import_id FK
    }

    imports {
        int id PK
        string filename
        int account_id FK
        string date_start
        string date_end
        int row_count
    }

    autocat_stats {
        string word PK
        string category_code PK
        int count
    }

    projects {
        int id PK
        string name
        string start_date
        string end_date
        real initial_balance
    }

    project_subscriptions {
        int id PK
        int project_id FK
        string type
        real amount
        string periodicity
    }

    import_templates {
        int id PK
        string name
        int account_id FK
        string column_roles_json
    }
```

Les cinq premières relations sont contraintes par SQLite lorsqu’une clause `REFERENCES` est
présente. Les relations vers contacts, documents et donateurs sont des identifiants métier sans
contrainte FK ; les services doivent donc préserver leur cohérence.

### Tables à payload JSON

```mermaid
flowchart LR
    EM[invoice_emetteur] --> EJS[EmetteurExtended JSON]
    IS[invoice_settings] --> IJS[InvoiceSettings JSON]
    CL[clients] --> CJS[Client JSON]
    DV[devis] --> DJS[Devis JSON]
    FA[factures] --> FJS[Facture + paiements JSON]
    CG[contact_groups] --> GJS[ContactGroupe JSON]
    AC[association_config] --> AJS[AssociationConfig JSON]
    DO[donateurs] --> DOJS[Donateur JSON]
    DM[dons_manuels] --> DMJS[Don JSON]
    RR[registre_recus] --> RRJS[ReceiptEntry JSON]
```

Les colonnes dédiées (`numero`, `statut`, `client_id`, `updated_at`, etc.) servent au tri et à la
recherche. Le payload est la représentation métier complète.

### Conventions de montants et dates

| Règle | Détail |
|-------|--------|
| Dates | Stockées en `TEXT` ISO `yyyy-MM-dd` |
| Débits | Valeurs ≤ 0 |
| Crédits | Valeurs ≥ 0 |
| Catégorie `X` | Exclue des KPI (`excludeCategories`) |
| Catégorie `Y` | Exclue de certains graphiques Dashboard |
| Solde compte | `initial_balance` + SUM(credit + debit) jusqu'à la date cible |

---

## 4. Processus d'import (Upload)

```mermaid
flowchart LR
    A[Fichier CSV/XLSX] --> B[FileDetectionService]
    B --> C[ColumnMappingService]
    C --> D[transformRows]
    D --> E[Aperçu UI]
    E --> F{Chevauchement?}
    F -->|Oui| G[ConfirmModal]
    F -->|Non| H[ImportService.importRows]
    G --> H
    H --> I[(INSERT transactions + imports)]
```

| Étape | Service | Opération SQL |
|-------|---------|---------------|
| Détection format | `FileDetectionService` | — (parse fichier en mémoire) |
| Mapping colonnes | `ColumnMappingService` | — |
| Transformation | `transformRows()` | — |
| Vérification chevauchement | `ImportService.findOverlaps()` | `SELECT` sur `imports` + plage dates |
| Import | `ImportService.importRows()` | `INSERT INTO imports`, `INSERT INTO transactions` (transaction SQL) |
| Template sauvegardé | `ImportTemplateService` | `INSERT/UPDATE import_templates` |

**Pas d'auto-catégorisation à l'import** (parité Comptal2) : les transactions arrivent sans `category_code` ou avec celle du fichier si mappée.

---

## 5. Processus d'édition

```mermaid
flowchart TB
    F[Filtres UI] --> W[EditionService.buildWhere]
    W --> Q[SELECT paginé]
    Q --> T[TransactionTable]
    T -->|modification| U[EditionService.update]
    U --> L[AutoCategorisationService.learn]
    L --> S[(UPDATE transactions)]
    S --> R[(UPSERT autocat_stats)]
    U --> H[useEditionHistory.push]
    H --> Z{Annuler / refaire}
    Z --> REPLAY[update / restore / remove]
    REPLAY --> T
    T --> WIDTH[EditionUiService]
    WIDTH --> PREF[edition_ui.json du profil]
```

| Action utilisateur | Service | SQL |
|--------------------|---------|-----|
| Lister / filtrer | `EditionService.list()` | `SELECT … WHERE … ORDER BY … LIMIT/OFFSET` |
| Modifier une ligne | `EditionService.update()` | `UPDATE transactions SET … WHERE id = ?` |
| Apprendre catégorie | `AutoCategorisationService.learn()` | `INSERT OR REPLACE autocat_stats` |
| Suggérer catégories | `AutoCategorisationService.suggest()` | Lecture `autocat_stats` en mémoire |
| Appliquer suggestions | `EditionService.applyCategories()` | Batch `UPDATE` |
| Insérer ligne | `EditionService.insert()` | `INSERT INTO transactions` |
| Supprimer | `EditionService.remove()` / `deleteIds()` | `DELETE FROM transactions` |
| Doublons | `EditionService.findDuplicates()` | `GROUP BY` date+montant+libellé+compte |

---

## 6. Processus d'agrégation (Dashboard & Finance)

Les deux pages consomment **`StatsService`** qui traduit les filtres UI en clauses SQL `WHERE`.

```mermaid
flowchart LR
    UI[Filtres: comptes, catégories, dates, recherche]
    UI --> SF[StatsFilters]
    SF --> SS[StatsService]
    SS --> SQL[(SELECT SUM/GROUP BY)]
    SQL --> CHART[Chart.js]
    SQL --> TABLE[Tableaux Finance intégrés]
    SQL --> SUMMARY[Résumé Dashboard]
```

| Méthode StatsService | Usage | Type de requête |
|----------------------|-------|-----------------|
| `kpis()` | KPI Dashboard/Finance | `SUM`, `COUNT`, `MAX` |
| `categoryTotals()` | Barres dépenses par catégorie | `GROUP BY category_code` |
| `accountBalancesAt()` | Soldes à une date | Somme cumulée |
| `balancesOverPeriod()` | Courbe soldes | CTE / fenêtre temporelle |
| `categoryByPeriod()` | Barres mensuelles | `GROUP BY strftime(period)` |
| `bilanByPeriod()` | Onglet Bilan | Crédits/débits par catégorie |
| `listTransactions()` / `listAllTransactions()` | Export et rapprochements métier | `SELECT` paginé/complet |

**Granularité** : `autoGranularity()` choisit jour/semaine/mois/trimestre/année selon l'amplitude de la plage.

---

## 7. Processus prévisionnel

```mermaid
flowchart LR
    P[ProjectService.list/get] --> PS[listSubscriptionTree]
    PS --> GRID[ForecastGrid]
    GRID -->|édition| MUT[add/update/remove/reorder]
    MUT --> PS
    PS --> MODEL[ForecastModel.computeForecast]
    MODEL --> PROJ[ProjectionService]
    PROJ --> WIDGETS[Widgets statistiques et graphiques]
    LAYOUT[widget_layout JSON] --> GRID
    LAYOUT --> WIDGETS
```

- La grille transforme l’arbre persisté en lignes éditables.
- Les groupes sont reliés par `parent_id` et ordonnés par `sort_order`.
- `ForecastModel` calcule les occurrences, les soldes et les ventilations en mémoire.
- La configuration des colonnes, widgets, granularité et split est persistée dans `widget_layout`.

## 8. Processus Contacts → Devis → Facture → Paiement

```mermaid
flowchart TD
    CONTACT[Créer/sélectionner un contact] --> QUOTE[Créer un devis numéroté]
    QUOTE --> LINES[Ajouter postes matériel/travail]
    LINES --> TOTALS[Calcul HT + TVA + TTC]
    TOTALS --> SAVEQ[(UPSERT devis)]
    SAVEQ --> DECISION{Décision client}
    DECISION -->|Caduc/refusé| CADUC[Signature de caducité<br/>document conservé]
    DECISION -->|Accepté| INVOICE[Générer une facture rattachée]
    INVOICE --> SAVEI[(UPSERT factures)]
    SAVEI --> MATCH[Recherche transactions créditrices]
    MATCH --> WHY{Numéro dans libellé<br/>ou montant proche ?}
    WHY -->|Oui| LINK[Lier comme paiement]
    WHY -->|Non| MANUAL[Paiement manuel chèque/espèces]
    LINK --> STATUS[Recalcul statut et reste dû]
    MANUAL --> STATUS
```

`InvoiceService` assure les numéros uniques au niveau applicatif et sérialise les dates.
`PaymentTrackingService` classe les correspondances par libellé, montant ou les deux.

## 9. Processus Association

```mermaid
flowchart TD
    CONFIG[Configuration association] --> DONOR[Créer un donateur]
    DONOR --> SOURCE{Origine du don}
    SOURCE -->|Transaction créditrice| MAP[Lier transaction ↔ donateur]
    SOURCE -->|Saisie| MANUAL[Créer un don manuel]
    MAP --> RECEIPT[Préparer le reçu]
    MANUAL --> RECEIPT
    RECEIPT --> NUM[Incrémenter RECU-année-compteur]
    NUM --> PDF[Générer le PDF fiscal]
    PDF --> REGISTER[(Inscrire registre_recus)]
    REGISTER --> CANCEL{Annulation ?}
    CANCEL -->|Oui| MARK[Marquer annule + date<br/>sans supprimer]
```

---

## 10. Processus de migration Comptal2

```mermaid
flowchart LR
    DIR[Dossier profil Comptal2] --> A[MigrationService.analyze]
    A --> UI[DataTab — aperçu]
    UI --> M[MigrationService.migrate]
    M --> SQL[(INSERT accounts, categories, transactions)]
```

| Source Comptal2 | Destination Comptal2.1 |
|-----------------|------------------------|
| `parametre/*.json` | Tables `accounts`, `categories` |
| `data/*.csv` | Table `transactions` + `imports` |
| Clé fragile `Source\|rowIndex\|…` | PK `id` auto-incrémentée |

Lecture via `read_external_*` (chemin absolu choisi par dialog).

---

## 11. Processus d'export

| Export | Service | Destination |
|--------|---------|-------------|
| Transactions CSV (Dashboard) | `ExportService.exportTransactionsCsv()` | Fichier externe via dialog `save` |
| Profil ZIP | `ProfileService.exportZip()` | `zip_dir` → chemin absolu |

---

## 12. Journalisation (logs JSONL)

Tout appel métier important passe par `withLog()` :

| Type fichier | Contenu |
|--------------|---------|
| `*_app.jsonl` | Événements applicatifs |
| `*_error.jsonl` | Erreurs |
| `*_data.jsonl` | Requêtes SQL, opérations données |
| `*_perf.jsonl` | Durées > 100 ms |

Écriture via `tauriBridge.appendTextLine()` → commande Rust `append_text_line`.

---

## 13. Résumé des flux par page

| Page | Lecture | Écriture |
|------|---------|----------|
| Dashboard | `StatsService`, `ConfigService` | `ExportService` (CSV externe) |
| Upload | `FileDetectionService`, `ConfigService`, `ImportTemplateService` | `ImportService` → SQL |
| Édition | `EditionService`, `ConfigService`, `AutoCategorisationService` | `EditionService` → SQL |
| Finance | `StatsService`, `ProjectService`, `ProjectionService` | `ProjectService` (projets) |
| Prévisionnel | `ProjectService`, `ForecastModel`, `ProjectionService` | Prévisions, lignes et layout |
| Contacts | `ClientService`, `ContactGroupService`, `InvoiceService` | Contacts et groupements |
| Facturation | Services contacts, émetteur, postes, documents et transactions | Devis, factures, paiements, pièces jointes |
| Association | Services donateurs, dons, reçus et postes | Configuration, dons, liens et reçus |
| Paramètres | Tous services config | `SettingsService`, `ProfileService`, `ConfigService`, `MigrationService`, `Db` |

---

## 14. Fichiers clés du code

| Fichier | Rôle dans le flux |
|---------|-------------------|
| `src/main.tsx` | Orchestration boot |
| `src/services/db.ts` | Schéma, migrations, accès SQLite |
| `src/services/ProfileService.ts` | Cycle de vie profil + DB |
| `src/services/ImportService.ts` | INSERT import |
| `src/services/EditionService.ts` | CRUD transactions |
| `src/services/StatsService.ts` | Agrégats lecture seule |
| `src/services/ProjectService.ts` | Prévisions et arbre de lignes |
| `src/services/ForecastModel.ts` | Calcul des widgets prévisionnels |
| `src/services/ClientService.ts` | Contacts |
| `src/services/InvoiceService.ts` | Documents de facturation |
| `src/services/PaymentTrackingService.ts` | Rapprochement des paiements |
| `src/services/DonateurService.ts` | Donateurs et liens bancaires |
| `src/services/tauri.ts` | Pont FS / session |
| `src-tauri/src/paths.rs` | Résolution chemins data |
