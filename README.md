# Comptal2

Logiciel de comptabilité moderne multi-plateforme pour la gestion et l'analyse de vos transactions financières.

## Description

Comptal2 est une application desktop développée avec Electron et React qui permet de gérer efficacement vos transactions bancaires. L'application offre une interface intuitive pour importer, analyser et visualiser vos données financières avec des graphiques et des statistiques détaillées.

## Fonctionnalités principales

- **Import de données** : Importation de fichiers CSV et Excel avec détection automatique des colonnes
- **Tableau de bord** : Vue d'ensemble avec statistiques, soldes par compte et graphiques interactifs
- **Filtres avancés** : Filtrage par compte, catégorie, période et recherche textuelle
- **Édition** : Modification et gestion des transactions
- **Analyse financière** : Graphiques et analyses détaillées de vos finances
- **Catégorisation automatique** : Classification automatique des transactions
- **Multi-comptes** : Gestion de plusieurs comptes bancaires
- **Export** : Exportation des données au format CSV
- **Thème sombre** : Support du mode sombre
- **Multi-langues** : Interface disponible en français et en anglais

## Installation

### Windows

1. Téléchargez l'installateur depuis la [section Releases](https://github.com/VOTRE_USERNAME/VOTRE_REPO/releases)
2. Exécutez `Comptal2-1.0.0-win-x64.exe`
3. Suivez les instructions d'installation
4. Lancez l'application depuis le menu Démarrer ou le raccourci sur le bureau

### macOS
En cours de développement...

### Linux

En cours de développement...

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

npm install### Développement

npm run electron:dev### Build

# Build pour Windows
npm run build:win

# Build pour macOS
npm run build:mac

# Build pour Linux
npm run build:linux

# Build pour toutes les plateformes
npm run build:all## Structure du projet
