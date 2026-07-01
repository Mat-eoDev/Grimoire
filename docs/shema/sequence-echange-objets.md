# Sequence inventaire et echange d'objets

## Objectif

Montrer la gestion de l'inventaire, le don direct et l'echange entre joueurs.

## Competences demontrees

- Developpement de regles metier
- Controle des droits
- Mise a jour transactionnelle des donnees metier
- Synchronisation par evenement SSE

```mermaid
sequenceDiagram
    actor GM as Maitre du Jeu
    actor A1 as Joueur expediteur
    actor A2 as Joueur destinataire
    participant API as API Express
    participant DB as PostgreSQL via Prisma
    participant SSE as SSE Hub

    GM->>API: POST /campaigns/:id/inventory/give
    API->>DB: Verifie role MJ
    API->>DB: Verifie joueur destinataire
    API->>DB: Recherche Item par slug
    API->>DB: Cree InventoryEntry
    API-->>GM: Objet attribue

    A1->>API: POST /campaigns/:id/trades
    API->>DB: Verifie membre campagne
    API->>DB: Verifie possession de l'objet propose
    API->>DB: Verifie objet demande si present
    API->>DB: Cree TradeOffer PENDING
    API->>SSE: Broadcast trade:offered
    SSE-->>A2: Notification d'offre

    A2->>API: POST /campaigns/:id/trades/:tradeId/accept
    API->>DB: Verifie destinataire et statut PENDING
    API->>DB: Transfere l'objet propose
    API->>DB: Transfere l'objet demande si present
    API->>DB: Passe TradeOffer a ACCEPTED
    API->>SSE: Broadcast trade:accepted
```

## Regles importantes

- Un joueur ne peut pas echanger avec lui-meme.
- L'expediteur doit posseder l'objet propose.
- Le destinataire doit posseder l'objet demande si l'echange en demande un.
- Une offre acceptee annule les offres concurrentes sur le meme objet.

