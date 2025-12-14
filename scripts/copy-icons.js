const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../src/renderer/icone');
const targetDir = path.join(__dirname, '../build');

// Créer le dossier build s'il n'existe pas
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Mapping des fichiers source vers les noms de destination
const iconMapping = [
  { source: 'Comptal2.ico', target: 'icon.ico' },
  { source: 'Comptal2.icns', target: 'icon.icns' },
  { source: 'Comptal2.png', target: 'icon.png' }
];

console.log('Copie des icônes...');

iconMapping.forEach(({ source, target }) => {
  const sourcePath = path.join(sourceDir, source);
  const targetPath = path.join(targetDir, target);

  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`✓ ${source} → ${target}`);
  } else {
    console.warn(`⚠ Fichier introuvable: ${sourcePath}`);
  }
});

console.log('Copie des icônes terminée !');

