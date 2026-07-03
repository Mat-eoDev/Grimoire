# Grimoire — English README

Web application to assist tabletop RPG Game Masters (GM): real-time campaign management,
scenes, dice rolls with consequences, inventory and player trading.

- Backend: `Node + Express + Prisma + PostgreSQL`
- Frontend: `React + Vite`
- Auth: `HttpOnly` cookie sessions (SHA-256 hashed tokens)
- Real-time: `Server-Sent Events`
- Live app: https://grimoire-q9hj.onrender.com

## Local setup

1. Copy `.env.example` to `.env`
2. Start PostgreSQL: `docker compose up -d`
3. Install dependencies: `npm install`
4. Generate Prisma & migrate: `npm run prisma:generate && npm run prisma:migrate`
5. Seed reference data: `npm run prisma:seed`
6. Run backend and frontend: `npm run dev:server` / `npm run dev:web`

## Quality gates

```bash
npm run check                              # TypeScript static analysis (server + web)
npm --workspace @newmj/server test         # Unit tests
npm run build                              # Production build
```

## Repository layout

```
apps/server   Express API, Prisma schema & migrations, business libs
apps/web      React + Vite single-page app
docs          UML, professional dossier (competency deliverables)
```

See `docs/dossier professionel/livrables/` for the full competency dossier (FR).
