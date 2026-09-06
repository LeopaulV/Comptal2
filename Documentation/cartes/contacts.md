# Carte — Contacts

## Dépendances

```mermaid
flowchart LR
    PAGE[Client.tsx] --> TREE[ClientTree]
    TREE --> FICHE[ContactFicheModal]
    TREE --> DETAIL[ContactElementModal]
    FICHE --> CLIENT[ClientService]
    FICHE --> SIRENE[SireneAPIService]
    TREE --> GROUP[ContactGroupService]
    DETAIL --> INVOICE[InvoiceService]
    CLIENT --> CT[(clients)]
    GROUP --> CG[(contact_groups)]
    INVOICE --> DOCS[(devis / factures)]
```

## Opérations

| Action | Fonction | Résultat |
|---|---|---|
| Charger | `ClientService.loadClients` | Réhydratation des dates/adresses |
| Chercher | `ClientService.searchClients` | Filtrage normalisé sans accents |
| Enregistrer | `ClientService.upsertClient` | Code généré + UPSERT du payload |
| Grouper | `ContactGroupService` | CRUD du groupement |
| Ouvrir un encart | `ContactElementModal` | Documents associés au `clientId` |

## Arborescence

```
Client.tsx
└── ClientTree
    ├── reload → ClientService.loadClients, InvoiceService.loadDevis/loadFactures, ContactGroupService.loadGroupes
    ├── saveClient → ClientService.upsertClient
    ├── createGroupe / deleteGroupe → ContactGroupService
    ├── DonationService.listByContact
    ├── ContactFicheModal / ClientForm / EntrepriseSearch
    ├── ContactElementModal
    └── DevisModal / FactureModal / PaiementFactureModal / CaducDevisModal / DonationFormModal
```
