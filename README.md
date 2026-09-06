# Comptal2

Logiciel desktop de **suivi de trésorerie**, de **facturation** et de **gestion des dons associatifs**. Les données restent sur la machine : pas de compte cloud, pas de serveur métier.

Version actuelle : **Comptal2.1** (`2.1.0`) — Tauri 2, React et SQLite.

> Comptal2 n’est ni une plateforme agréée de facturation électronique, ni un logiciel de caisse certifié, ni un substitut à un expert-comptable. Ce n’est pas une comptabilité en partie double (pas de FEC).

## Documentation

Toute la documentation du projet part de l’index :

**[Documentation — Index](./Documentation/00-index.md)**

On y trouve notamment :

- la [vue d’ensemble](./Documentation/vue-ensemble-realisations.md) des modules
- l’[architecture et le code](./Documentation/architecture-et-code.md)
- le [schéma SQLite](./Documentation/schema-sqlite.md)
- les pages (tableau de bord, import, édition, facturation, dons, etc.)

## Présentation

Comptal2 sert à importer des relevés, classer les mouvements, suivre les soldes et produire des documents (devis, factures, reçus fiscaux) **en local**.

Chaque profil a sa propre base SQLite (`comptal.db`). On peut en créer plusieurs et les exporter ou les importer en ZIP.

### Fonctionnalités

| Module | Rôle |
|---|---|
| **Tableau de bord** | KPI, soldes, graphiques et filtres |
| **Import** | CSV, Excel ou saisie manuelle, avec mapping réutilisable |
| **Édition** | Table des transactions, auto-catégorisation, doublons, annuler/refaire |
| **Finance globale** | Analyses mensuelles, soldes, bilan, facturation et dons |
| **Prévisionnel** | Prévisions, récurrences et widgets de synthèse |
| **Contacts** | Particuliers et entreprises, groupements, liens vers les documents |
| **Facturation** | Devis, factures, postes, paiements et PDF |
| **Dons** | Journal des dons, rapprochement bancaire et reçus fiscaux |
| **Registre** | Documents de période, pièces jointes et PDF |
| **Paramètres** | Profils, comptes, catégories, organisation, thèmes et mises à jour |

## Technique

- **Stack** : Tauri 2, React 18, TypeScript, Vite, Tailwind, SQLite
- **Persistance** : une base par profil ; en développement sous `data/` (ignoré par Git)
- **Plateformes packagées** : Windows (NSIS), Linux (deb / rpm)

### Développement

```bash
npm install
npm run tauri:dev
```

Build d’installateur :

```bash
npm run tauri:build:windows   # NSIS
npm run tauri:build:linux     # deb + rpm
```

Un profil de test reproductible peut être généré avec `npm run db:dev` (voir [Base de développement](./Documentation/base-developpement.md)).
