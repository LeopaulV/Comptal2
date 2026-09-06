# Format d’export expert-comptable (trésorerie)

**Ce fichier n’est pas un FEC.** Comptal2.1 n’exporte pas le Fichier des Écritures Comptables (LPF L. 47 A). Cet export sert à **alimenter** un logiciel de comptabilité (Sage, Cegid, Quadra, etc.) ou un cabinet.

Nom de fichier type : `comptal_tresorerie_AAAA-MM-JJ_AAAA-MM-JJ.csv`

Encodage : UTF-8. Délimiteur par défaut : `;` (modifiable par un mod `export_mapper`).

## Colonnes par défaut

| En-tête | Champ interne | Contenu |
|---|---|---|
| Date | `date` | Date de l’opération (jj/mm/aaaa) |
| Compte | `account` | Code du compte bancaire Comptal |
| Libellé | `label` | Libellé de la transaction |
| Débit | `debit` | Montant débiteur (virgule décimale) |
| Crédit | `credit` | Montant créditeur |
| Catégorie | `category` | Code catégorie Comptal (pas un compte PCG) |
| N° facture | `invoiceNumero` | Numéro(s) de facture liés via un paiement |

Les transactions **archivées** (`deleted_at`) sont exclues.

## Mods `export_mapper`

Un plugin de type `export_mapper` peut réordonner / renommer les colonnes. Champs autorisés uniquement : `date`, `account`, `label`, `debit`, `credit`, `category`, `invoiceNumero`.

Voir `Documentation/plugins-mods.md` et `Documentation/exemples-plugins/`.

## P1 (hors session)

- Mapping vers des comptes PCG Sage/Cegid/Quadra (mod dédié par éditeur)
- Factur-X / UBL
- FEC uniquement si un jour Comptal devient une comptabilité informatisée (position C — non retenue)
