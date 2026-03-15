# Comptal2

Logiciel de comptabilité moderne **multi-plateforme** (Windows, macOS, Linux) pour la gestion et l'analyse de vos transactions financières.

## Description

Comptal2 est une application desktop (Electron + React) pour gérer vos transactions bancaires : import CSV/Excel, tableau de bord, analyse par catégories et par projets. Interface intuitive, graphiques interactifs et vues dédiées (Entreprise, Association, Gestion, Projet).

## Fonctionnalités principales

- **Import de données** — CSV et Excel, détection automatique des colonnes, mapping personnalisable
- **Tableau de bord** — Statistiques en temps réel, soldes par compte, graphiques interactifs (camemberts, barres)
- **Finance global** — Revenus vs dépenses, analyses mensuelles, tendances et nouveaux graphiques d’analyse
- **Pages dédiées** — Entreprise, Association, Gestion et Projet pour organiser vos contextes
- **Filtres avancés** — Par compte, catégorie, période (curseur de dates), recherche textuelle
- **Gestion des transactions** — Édition, suppression, saisie manuelle
- **Catégorisation automatique** — Règles configurables et apprentissage des patterns récurrents
- **Multi-comptes** — Plusieurs comptes bancaires, soldes individuels et vue consolidée
- **Export** — Export CSV des transactions selon les filtres appliqués
- **Interface** — Thème sombre, responsive, français / anglais

## Installation

Téléchargez la dernière version dans la [section Releases](https://github.com/LeopaulV/Comptal2/releases).

### Windows

1. Téléchargez `Comptal2-1.1.0-win-x64.exe`
2. Double-cliquez sur l’installateur et suivez les instructions
3. Lancez Comptal2 depuis le menu Démarrer ou le raccourci bureau

### macOS

- **Intel** : `Comptal2-1.1.0-darwin-x64.dmg`
- **Apple Silicon (M1/M2/M3)** : `Comptal2-1.1.0-darwin-arm64.dmg`

Ouvrez le DMG, puis glissez Comptal2 dans le dossier Applications. macOS 10.15 (Catalina) ou supérieur.

### Linux

1. Téléchargez `Comptal2-1.1.0-linux-x86_64.AppImage`
2. Rendez-le exécutable : `chmod +x Comptal2-1.1.0-linux-x86_64.AppImage`
3. Lancez-le : `./Comptal2-1.1.0-linux-x86_64.AppImage` ou double-clic dans le gestionnaire de fichiers

Données utilisateur : `~/.config/comptal2/`

## Utilisation

### Première utilisation

1. Lancez l'application
2. Allez dans **Paramètres** pour configurer vos comptes et catégories
3. Utilisez la page **Import** pour charger vos fichiers CSV ou Excel
4. Consultez le **Tableau de bord** pour visualiser vos données

### Import de fichiers

L'application détecte automatiquement les colonnes de vos fichiers CSV/Excel. Vous pouvez mapper manuellement les colonnes si nécessaire :
- Date
- Libellé
- Montant
- Compte
- Catégorie

## Technologies utilisées

- **Electron** : Framework pour applications desktop
- **React** : Bibliothèque JavaScript pour l'interface utilisateur
- **TypeScript** : Typage statique pour JavaScript
- **Vite** : Outil de build moderne
- **Chart.js / Recharts** : Bibliothèques de graphiques
- **Tailwind CSS** : Framework CSS utilitaire

## Développement

### Prérequis

- Node.js (version 18 ou supérieure)
- npm ou yarn

### Installation des dépendances

```bash
npm install
```

### Développement

```bash
npm run electron:dev
```

### Build

```bash
# Build pour Windows
npm run build:win

# Build pour macOS
npm run build:mac

# Build pour Linux
npm run build:linux

# Build pour toutes les plateformes
npm run build:all
```

## Structure du projet
