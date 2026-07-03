# Environnement d'exécution & scripts système — Grimoire

*Compétence visée : C36 (écrire des scripts pour automatiser installation, configuration et simulation de l'environnement d'exécution, multi-tiers).*

## 1. Environnement multi-tiers

| Tier | Composant | Local | Production |
|---|---|---|---|
| Présentation/API | Node + Express + React (build) | `npm run dev:*` | Service Render |
| Données | PostgreSQL | Docker (`postgres:16-alpine`) | Neon managé |
| Services externes | Brevo (email) | optionnel (ignoré si non configuré) | variables Render |

## 2. Scripts d'automatisation présents

### Base de données locale — `docker-compose.yml`
Provisionne PostgreSQL 16 avec volume persistant, port 5432, identifiants de dev. Un seul
`docker compose up -d` simule le tier données.

### Environnement de développement reproductible — `.devcontainer/`
- `devcontainer.json` : ports forwardés (4000, 5173, 5432), extensions VS Code, `postStartCommand`.
- `docker-compose.yml` : services de dev.
- `setup.sh` : script d'amorçage (installation/configuration au démarrage du conteneur).

### Cycle applicatif — `package.json` (racine)
| Script | Rôle |
|---|---|
| `render-build` | `install → prisma:generate → build → prisma:deploy → prisma:seed` (chaîne de déploiement) |
| `build` | Build serveur (tsc) + web (Vite) |
| `check` | Analyse statique (tsc serveur + web) |
| `prisma:generate` / `:migrate` / `:deploy` / `:seed` | Cycle de vie du schéma et des données |
| `dev:server` / `dev:web` | Lancement en développement |

### Déploiement — `render.yaml` (Infrastructure as Code)
Décrit le service web, la région, le healthcheck (`/health`), les variables d'environnement et
la commande de build. Le déploiement est **reproductible et versionné**.

### Seed idempotent — `apps/server/prisma/seed.ts`
Peuple les `RevelationAsset` à partir des images du dépôt (upsert → rejouable sans doublon).

## 3. Preuve de fonctionnement de l'environnement

```bash
# 1. Tier données
docker compose up -d
# 2. Schéma + données
npm run prisma:generate && npm run prisma:migrate && npm run prisma:seed
# 3. Contrôles qualité
npm run check && npm --workspace @newmj/server test
# 4. Build livrable
npm run build
# 5. Santé (prod)
curl -s https://grimoire-q9hj.onrender.com/health   # {"status":"ok",...}
```

## 4. Simulation / mise à disposition

- L'environnement complet (3 tiers) se monte en **2 commandes** (`docker compose up` + `npm run dev:*`).
- Le devcontainer garantit la **reproductibilité** entre machines (même version d'outils).
- La chaîne `render-build` **automatise entièrement** installation, configuration (migrations),
  et amorçage des données lors de chaque mise en production.
