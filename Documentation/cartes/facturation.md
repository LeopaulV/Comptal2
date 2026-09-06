# Carte — Facturation

## Flux documentaire

```mermaid
stateDiagram-v2
    [*] --> Devis
    Devis --> Envoye
    Envoye --> Accepte
    Envoye --> Caduc: signature + motif éventuel
    Accepte --> Facture: génération liée
    Facture --> Envoyee
    Envoyee --> Partielle: paiement < TTC
    Envoyee --> Payee: paiement = TTC
    Envoyee --> Retard: échéance dépassée
    Partielle --> Payee
    Caduc --> [*]: document conservé
    Payee --> [*]
```

## Dépendances

```mermaid
flowchart LR
    UI[DocumentsPanel / modales] --> INV[InvoiceService]
    UI --> POSTE[PosteService]
    UI --> PAY[PaymentTrackingService]
    UI --> PDF[PDFService]
    INV --> EMIT[EmetteurService]
    INV --> ATT[AttachmentService]
    PAY --> STATS[StatsService]
    INV --> DB[(devis / factures)]
    POSTE --> PDB[(postes / groupes / secteurs)]
    STATS --> TX[(transactions)]
    PDF --> FILE[Fichier PDF externe]
```

## Calcul d’un paiement proposé

```mermaid
flowchart TD
    TX[Transaction créditrice non liée] --> LABEL{Libellé contient le numéro ?}
    TX --> AMOUNT{Montant proche du TTC ou reste ?}
    LABEL --> SCORE[Score]
    AMOUNT --> SCORE
    SCORE --> SORT[Tri score puis date]
    SORT --> LINK[Liaison explicite ou automatique par libellé]
    LINK --> STATUS[Statut + reste à encaisser]
```

## Arborescence des fonctions

```
Facturation.tsx
├── setTab('docs' | 'postes')
├── DocumentsPanel
│   ├── reload → ClientService.loadBillingClients, InvoiceService.loadDevis/loadFactures, StatsService.listAllTransactions
│   ├── openPdf → PDFService + AttachmentService
│   ├── DevisModal / FactureModal → DocumentEditor
│   │   ├── InvoiceService.calculateTotals / peekNextNumero / generateNumero / upsertDevis / upsertFacture
│   │   └── PosteService.loadPostes
│   ├── GestionDevisRow / GestionFactureRow
│   ├── PaiementFactureModal → PaymentTrackingService
│   └── CaducDevisModal → InvoiceService.markDevisCaduc
└── PostesPanel kind="facturation"
    └── PosteService.loadPostes / savePostes / loadPostesGroupes / savePosteGroupe
```

