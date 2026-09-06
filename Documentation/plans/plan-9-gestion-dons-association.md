# Plan 9 — Gestion des dons et fonctions associatives

## Audit de Comptal2

L’ancienne page Association réunissait cinq responsabilités : identité légale et modèle PDF,
fichier séparé de donateurs, rapprochement des transactions créditrices, saisie de dons manuels
et anonymes, reçus fiscaux/registre, charges récurrentes et graphiques. Les données étaient
réparties entre `association_config.json`, `donateurs.json`, `donateur_transactions.json`,
`dons_manuels.json` et `registre_recus.json`.

Les fonctions reprises sont :

- association, habilitation fiscale, signataire et apparence des reçus ;
- donateur particulier ou personne morale ;
- corrélation manuelle transaction–donateur et corrélation régulière par catégorie/libellé ;
- don en numéraire, don en nature et mécénat de compétences ;
- mode de versement en espèces, chèque, virement, carte ou prélèvement ;
- dons anonymes, reçus nominatifs, annulations conservées et états annuels.

Les charges relèvent du Prévisionnel et les graphiques sont hors périmètre. Le paramétrage ne
figure plus sur la page métier.

## Terminologie et règles

- « Espèces » est un mode de versement d’un **don en numéraire**.
- Un bien ou un service constitue un **don en nature**. Son montant est une **valorisation**,
  communiquée sous la responsabilité du donateur ; « valeur vénale » peut être une méthode
  d’évaluation, mais n’est pas une nature de don.
- Le mécénat de compétences est distingué pour décrire les personnels ou prestations concernés.
- Un don anonyme ne produit pas de reçu fiscal nominatif.
- Les particuliers relèvent du modèle 2041-RD ; les entreprises du 2041-MEC-SD
  (Cerfa n° 16216). Les doubles et justificatifs fiscaux sont à conserver.
- L’ancien registre spécial des associations n’est pas présenté comme une obligation générale
  actuelle. Comptal2.1 produit un journal des dons, un registre des reçus et l’état annuel du
  nombre/montant des reçus.

## Architecture cible

1. `Contacts` porte les rôles `client` et `donateur`, cumulables.
2. `donations` centralise les dons manuels et bancaires, l’anonymat, la nature, le mode,
   la valorisation et le reçu.
3. `donation_rules` automatise les corrélations récurrentes sur les crédits.
4. `Paramètres → Organisation` contient l’identité associative, l’éligibilité, le signataire,
   la séquence des reçus et le modèle PDF.
5. `Gestion des dons` couvre saisie, journal, rapprochement, règles et émission.
6. `Registre` fige et exporte les trois états associatifs sans modifier les documents déjà livrés.

## Migration

Le schéma v9 ajoute `donations` et `donation_rules`. À l’ouverture :

- les contacts existants reçoivent le rôle `client` ;
- les anciens `donateurs` deviennent des contacts avec le rôle `donateur` ;
- `dons_manuels` et `donateur_transactions` sont repris de façon idempotente ;
- les tables historiques restent disponibles pour les imports et la compatibilité.

## Plan de validation

1. Créer la base de démonstration en mémoire et vérifier schéma v9, intégrité et clés étrangères.
2. Vérifier les cinq formes de parcours : transaction, manuel, nature valorisée, espèces anonyme,
   reçu déjà émis.
3. Vérifier les contacts à rôle donateur, les règles et les instantanés officiels du Registre.
4. Exécuter le typecheck renderer et distinguer les erreurs préexistantes des régressions.
5. Lancer Tauri sans packaging et parcourir Organisation, Contacts, Gestion des dons et Registre.
