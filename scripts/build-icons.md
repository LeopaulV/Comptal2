# Génération des Icônes

Pour générer les icônes de l'application, vous aurez besoin d'une image source de haute qualité (idéalement 1024x1024 px).

## Formats requis

- **Windows** : `build/icon.ico` (256x256, 128x128, 64x64, 48x48, 32x32, 16x16)
- **Mac** : `build/icon.icns` (512x512, 256x256, 128x128, 64x64, 32x32, 16x16)
- **Linux** : `build/icon.png` (512x512)

## Outils recommandés

### En ligne
- [iConvert Icons](https://iconverticons.com/) - Conversion gratuite vers tous les formats

### Ligne de commande

#### Mac (pour générer .icns)
```bash
# Créer les différentes tailles
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png

# Générer le fichier .icns
iconutil -c icns icon.iconset -o build/icon.icns
```

#### Windows (avec ImageMagick)
```bash
magick convert icon.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico
```

## Icône temporaire

En attendant de créer votre propre icône, vous pouvez :
1. Utiliser un générateur d'icônes en ligne
2. Créer un simple logo avec vos initiales (ex: "C2" pour Comptal2)
3. Utiliser un pictogramme de calculatrice ou graphique financier

## Design suggestions

Pour un logiciel de comptabilité, considérez :
- Symboles : €, $, graphique, calculatrice
- Couleurs : bleu (confiance), vert (argent), violet (analyse)
- Style : moderne, professionnel, épuré

