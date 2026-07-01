# Sequence creation et entree dans une campagne

## Objectif

Montrer le workflow permettant au MJ de creer une campagne et au joueur de la rejoindre.

## Competences demontrees

- Developpement de composants metier
- Gestion des roles
- Acces aux donnees relationnelles
- Validation des regles metier

```mermaid
sequenceDiagram
    actor GM as Maitre du Jeu
    actor J as Joueur
    participant W as Frontend React
    participant A as API Express
    participant D as PostgreSQL via Prisma

    GM->>W: Cree une campagne
    W->>A: POST /campaigns
    A->>A: requireAuth
    A->>A: Genere joinCode unique
    A->>D: Cree Campaign en DRAFT
    A->>D: Cree CampaignMember role GM
    A-->>W: Campagne + code
    W-->>GM: Affiche le code de campagne

    J->>W: Saisit le code
    W->>A: POST /campaigns/join
    A->>A: requireAuth
    A->>D: Recherche Campaign par joinCode
    A->>D: Upsert CampaignMember role PLAYER
    A-->>W: Campagne rejointe
    W-->>J: Acces a la campagne
```

## Lancement de campagne

```mermaid
sequenceDiagram
    actor J as Joueur
    actor GM as Maitre du Jeu
    participant A as API Express
    participant D as PostgreSQL via Prisma

    J->>A: POST /campaigns/:id/ready
    A->>D: Verifie membre PLAYER
    A->>D: Bascule isReady
    A-->>J: Etat pret

    GM->>A: POST /campaigns/:id/launch
    A->>D: Verifie MJ
    A->>D: Verifie joueurs prets
    A->>D: Passe Campaign a ACTIVE
    A-->>GM: Campagne lancee
```

