# Sequence jet d'action

## Objectif

Montrer le cycle complet d'un jet d'action : demande du MJ, jet du joueur, resolution et consequence.

## Competences demontrees

- Developpement de composants metier
- Validation des entrees
- Application de regles metier
- Synchronisation temps reel
- Mise a jour de donnees relationnelles

```mermaid
sequenceDiagram
    actor GM as Maitre du Jeu
    actor J as Joueur
    participant WGM as Frontend MJ
    participant WJ as Frontend Joueur
    participant A as API Express
    participant D as PostgreSQL via Prisma
    participant SSE as SSE Hub

    GM->>WGM: Configure un jet d'action
    WGM->>A: POST /campaigns/:id/action-rolls
    A->>D: Verifie role MJ et campagne active
    A->>D: Verifie qu'aucun jet actif existe
    A->>D: Verifie joueur cible et seuils
    A->>D: Cree ActionRoll en PENDING
    A->>SSE: Broadcast action-roll:changed
    SSE-->>WJ: Le joueur recoit le jet

    J->>WJ: Lance le de
    WJ->>A: POST /campaigns/:id/action-rolls/:rollId/roll
    A->>D: Verifie membre et joueur concerne
    A->>D: Enregistre result et status ROLLED
    A->>SSE: Broadcast action-roll:changed
    SSE-->>WGM: Le MJ voit le resultat

    GM->>WGM: Valide la resolution
    WGM->>A: POST /campaigns/:id/action-rolls/:rollId/resolve
    A->>D: Calcule outcome
    A->>D: Applique consequence si necessaire
    A->>D: Passe le jet en RESOLVED
    A->>SSE: Broadcast action-roll:closed
    A->>SSE: Broadcast campaign:changed
```

## Consequences possibles

- Ajout d'une narration dans la scene.
- Degats sur un element de scene.
- Degats sur un joueur.
- Suppression d'une cible.
- Aucune consequence automatique.

