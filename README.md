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
- **Plateformes packagées** : Windows (NSIS `.exe`), Linux (deb / rpm)
- **Mises à jour** : l’app installée interroge les [GitHub Releases](https://github.com/LeopaulV/Comptal2/releases) (`latest.json`). Les profils restent dans `%APPDATA%\com.leopaul.comptal21\data` et ne sont pas écrasés.

### Développement

```bash
npm install
npm run tauri:dev
```

Build d’installateur :

```bash
npm run tauri:build:windows          # NSIS (.exe)
npm run tauri:build:windows:signed   # idem, avec signature updater
npm run tauri:build:linux            # deb + rpm
```

Pour publier une version Windows : incrémenter `version` dans `package.json` et `src-tauri/tauri.conf.json` / `Cargo.toml`, puis pousser un tag `vX.Y.Z` vers GitHub. Le workflow crée la Release avec `Comptal2.1_*_x64-setup.exe` et `latest.json`. Les secrets du dépôt doivent contenir `TAURI_SIGNING_PRIVATE_KEY` (contenu de `src-tauri/keys/comptal21.key`, jamais commité).

Un profil de test reproductible peut être généré avec `npm run db:dev` (voir [Base de développement](./Documentation/base-developpement.md)).
