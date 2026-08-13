# Sequence scene temps reel avec SSE

## Objectif

Montrer comment le MJ modifie une scene et comment les clients sont synchronises.

## Competences demontrees

- Echanges client / serveur
- Communication temps reel
- Filtrage des donnees selon le role
- Developpement d'une application interactive

```mermaid
sequenceDiagram
    actor GM as Maitre du Jeu
    actor J as Joueur
    participant WGM as Frontend MJ
    participant WJ as Frontend Joueur
    participant A as API Express
    participant SSE as SSE Hub
    participant D as PostgreSQL via Prisma

    WGM->>A: GET /campaigns/:id/stream
    A->>D: Verifie membre campagne
    A->>SSE: Inscrit la connexion MJ

    WJ->>A: GET /campaigns/:id/stream
    A->>D: Verifie membre campagne
    A->>SSE: Inscrit la connexion joueur

    GM->>WGM: Deplace un element de scene
    WGM->>A: PATCH /campaigns/:id/scene-elements/:elementId/position
    A->>D: Verifie role MJ et campagne active
    A->>D: Met a jour posX / posY
    A->>SSE: Broadcast element:moved
    SSE-->>WGM: Notification temps reel
    SSE-->>WJ: Notification temps reel
    WJ->>A: GET /campaigns/:id
    A->>D: Charge la campagne
    A->>A: Filtre les elements invisibles pour PLAYER
    A-->>WJ: Vue joueur mise a jour
```

## Points a presenter

- SSE evite au frontend de rafraichir en boucle.
- Le serveur reste la source de verite.
- Le filtrage de visibilite est fait cote backend.

