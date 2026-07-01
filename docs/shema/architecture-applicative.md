# Architecture applicative

## Objectif

Montrer l'organisation technique de l'application en couches.

## Competences demontrees

- Definition d'une architecture logicielle
- Developpement d'une application securisee organisee en couches
- Separation frontend, backend, ORM et base de donnees
- Mise en place d'un environnement de travail coherent

```mermaid
flowchart TB
    USER["Utilisateur<br/>MJ ou joueur"]

    subgraph FRONT["Frontend - apps/web"]
        REACT["React"]
        VITE["Vite"]
        PAGES["Pages<br/>HomePage / CampaignPage"]
        COMPONENTS["Composants UI<br/>inventaire, personnage, scene, echanges"]
        API_CLIENT["Client API<br/>apiFetch"]
    end

    subgraph BACK["Backend - apps/server"]
        EXPRESS["Express"]
        AUTH_MW["Middleware auth<br/>attachAuth / requireAuth"]
        ROUTES_AUTH["Routes auth"]
        ROUTES_CAMPAIGN["Routes campagnes"]
        ROUTES_INVENTORY["Routes inventaire"]
        ROUTES_TRADES["Routes echanges"]
        SSE["SSE Hub<br/>temps reel"]
        SERVICES["Lib metier<br/>session, password, stats"]
    end

    subgraph DATA["Persistance"]
        PRISMA["Prisma ORM"]
        POSTGRES["PostgreSQL"]
    end

    USER --> REACT
    REACT --> PAGES
    PAGES --> COMPONENTS
    COMPONENTS --> API_CLIENT
    API_CLIENT --> EXPRESS
    EXPRESS --> AUTH_MW
    EXPRESS --> ROUTES_AUTH
    EXPRESS --> ROUTES_CAMPAIGN
    EXPRESS --> ROUTES_INVENTORY
    EXPRESS --> ROUTES_TRADES
    ROUTES_CAMPAIGN --> SSE
    ROUTES_TRADES --> SSE
    ROUTES_AUTH --> SERVICES
    ROUTES_CAMPAIGN --> SERVICES
    SERVICES --> PRISMA
    ROUTES_AUTH --> PRISMA
    ROUTES_CAMPAIGN --> PRISMA
    ROUTES_INVENTORY --> PRISMA
    ROUTES_TRADES --> PRISMA
    PRISMA --> POSTGRES
```

## Choix techniques

- React et Vite pour une interface web rapide a developper.
- Express pour exposer une API HTTP.
- Prisma pour structurer les acces aux donnees.
- PostgreSQL pour une base relationnelle robuste.
- SSE pour synchroniser les actions de campagne en temps reel.

