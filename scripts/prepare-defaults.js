// Script pour copier les fichiers neutres depuis build/defaults/ vers parametre/ et data/
// Ce script est exécuté avant le build pour s'assurer que les fichiers neutres remplacent les fichiers actuels

const fs = require('fs');
const path = require('path');

const defaultsDir = path.join(__dirname, '..', 'build', 'defaults');
const parametreDir = path.join(__dirname, '..', 'parametre');
const dataDir = path.join(__dirname, '..', 'data');

console.log('[prepare-defaults] Préparation des fichiers neutres...');

// Fonction pour copier récursivement un dossier
function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[prepare-defaults] Le dossier source n'existe pas: ${src}`);
    return;
  }

  // Créer le dossier de destination s'il n'existe pas
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
    console.log(`[prepare-defaults] Dossier créé: ${dest}`);
  }

  // Lire le contenu du dossier source
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Copier récursivement les sous-dossiers
      copyDir(srcPath, destPath);
    } else {
      // Copier les fichiers
      fs.copyFileSync(srcPath, destPath);
      console.log(`[prepare-defaults] Fichier copié: ${entry.name}`);
    }
  }
}

// Copier les fichiers neutres
try {
  // Copier parametre/
  const defaultsParametreDir = path.join(defaultsDir, 'parametre');
  if (fs.existsSync(defaultsParametreDir)) {
    console.log('[prepare-defaults] Copie des fichiers parametre/...');
    copyDir(defaultsParametreDir, parametreDir);
  } else {
    console.warn('[prepare-defaults] Le dossier build/defaults/parametre/ n\'existe pas');
  }

  // Copier data/
  const defaultsDataDir = path.join(defaultsDir, 'data');
  if (fs.existsSync(defaultsDataDir)) {
    console.log('[prepare-defaults] Copie des fichiers data/...');
    copyDir(defaultsDataDir, dataDir);
  } else {
    console.warn('[prepare-defaults] Le dossier build/defaults/data/ n\'existe pas');
  }

  console.log('[prepare-defaults] Préparation terminée avec succès!');
} catch (error) {
  console.error('[prepare-defaults] Erreur lors de la préparation:', error);
  process.exit(1);
}

