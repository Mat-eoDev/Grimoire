# Diagramme de deploiement local

## Objectif

Montrer comment l'application est lancee et testee en environnement local.

## Competences demontrees

- Installation et configuration de l'environnement de travail
- Preparation du deploiement
- Utilisation de Docker pour la base de donnees
- Documentation technique exploitable

```mermaid
flowchart TB
    DEV["Poste developpeur"]

    subgraph NODE["Runtime Node.js"]
        WEB["Frontend Vite<br/>npm run dev:web"]
        API["Backend Express<br/>npm run dev:server"]
    end

    subgraph DOCKER["Docker Compose"]
        DB["PostgreSQL"]
    end

    ENV["Fichier .env<br/>DATABASE_URL, CLIENT_ORIGIN, SESSION_SECRET"]
    PRISMA["Prisma<br/>generate / migrate / seed"]
    BROWSER["Navigateur"]

    DEV --> ENV
    DEV --> WEB
    DEV --> API
    DEV --> DOCKER
    API --> PRISMA
    PRISMA --> DB
    BROWSER --> WEB
    WEB --> API
    API --> DB
```

## Scripts utiles

- `npm.cmd install`
- `docker compose up -d`
- `npm.cmd run prisma:generate`
- `npm.cmd run prisma:migrate`
- `npm.cmd run prisma:seed`
- `npm.cmd run dev:server`
- `npm.cmd run dev:web`
- `npm.cmd run check`
- `npm.cmd run build`

