# Diagramme d'etats - campagne

## Objectif

Montrer le cycle de vie d'une campagne dans le MVP.

## Competences demontrees

- Formalisation des etats applicatifs
- Regles de transition
- Conception de composants metier

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Creation par le MJ
    DRAFT --> ACTIVE: Tous les joueurs sont prets et le MJ lance
    ACTIVE --> CLOSED: Le MJ arrete la campagne
    CLOSED --> [*]

    DRAFT: Brouillon
    DRAFT: Les joueurs peuvent rejoindre avec le code
    DRAFT: Les joueurs peuvent se declarer prets

    ACTIVE: Campagne active
    ACTIVE: Scene, jets, inventaire et echanges utilisables

    CLOSED: Campagne terminee
    CLOSED: Nouvelle entree bloquee
```

## Etats presents dans Prisma

- `DRAFT`
- `ACTIVE`
- `CLOSED`

