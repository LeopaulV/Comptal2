# Plugins / mods Comptal2.1

## Comment importer un mod

1. Paramètre → **Plugins**
2. **Importer un mod (ZIP)**
3. Choisir un fichier `.zip` contenant un `manifest.json` à la racine **ou** dans un sous-dossier
4. Activer le plugin sur le **profil courant** (l’activation applique les packs)

Les mods sont stockés dans `data/plugins/{id}/` (global). L’activation (`plugin_state`) est **par profil**.

## Sécurité (P0)

- JSON et texte seulement (`.json`, `.txt`, `.md`, LICENSE, README)
- **Aucun** `.js`, binaire, natif
- **Pas d’`eval`**, pas d’iframe script
- Identifiant : `^[a-z0-9][a-z0-9._-]{1,63}$`

Un fork qui ajouterait du code exécutable n’est **pas** couvert par le périmètre Comptal.

## `manifest.json`

```json
{
  "format": "comptal21-plugin",
  "formatVersion": 1,
  "id": "fr-tpe-mentions",
  "name": "Mentions TPE France",
  "version": "1.0.0",
  "type": "mention_pack",
  "hooks": ["invoice.mentions"],
  "description": "Mentions pénalités / 40 € / escompte",
  "comptalMin": "2.1.0"
}
```

`type` : `category_pack` | `mention_pack` | `export_mapper` | `import_mapper`

## Fichiers payload

| Type | Fichier | Effet à l’activation |
|---|---|---|
| `category_pack` | `categories.json` | Crée les catégories / groupes **manquants** (n’écrase pas) |
| `mention_pack` | `mentions.json` | Fusionne les mentions légales du profil |
| `export_mapper` | `export.json` | Utilisé par l’export expert-comptable |
| `import_mapper` | `import.json` | Crée un modèle d’import (colonnes) s’il n’existe pas |

Exemples : `Documentation/exemples-plugins/`.

## P1

- Scripts JS sandboxed
- Plusieurs mappeurs d’export actifs au choix
- Boutique / signature des mods
