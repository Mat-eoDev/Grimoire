# Diagramme d'etats - offre d'echange

## Objectif

Montrer le cycle de vie d'une offre d'echange entre joueurs.

## Competences demontrees

- Workflow metier
- Gestion des statuts
- Validation des transitions

```mermaid
stateDiagram-v2
    [*] --> PENDING: Creation de l'offre
    PENDING --> ACCEPTED: Acceptation par le destinataire
    PENDING --> REFUSED: Refus par le destinataire
    PENDING --> CANCELLED: Annulation par l'expediteur
    ACCEPTED --> [*]
    REFUSED --> [*]
    CANCELLED --> [*]

    PENDING: Offre en attente
    ACCEPTED: Objets transferes
    REFUSED: Offre refusee
    CANCELLED: Offre annulee
```

## Etats presents dans Prisma

- `PENDING`
- `ACCEPTED`
- `REFUSED`
- `CANCELLED`

