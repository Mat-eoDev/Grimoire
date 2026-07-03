# Architecture logicielle — Grimoire

*Compétences visées : C2 (architecture qualité en couches), C15 (urbanisation SI), C29 (intégration de composants hétérogènes).*

## 1. Vue d'ensemble

Application web **mono-dépôt (monorepo npm workspaces)**, déployée en **service unique** :
le serveur Express sert à la fois l'API REST et le build statique React (même origine → pas de
problème CORS/cookies, SSE fiable).

```
Navigateur (React/Vite SPA)
        │  HTTPS (cookies HttpOnly) + SSE
        ▼
Express (apps/server)  ──►  Prisma Client  ──►  PostgreSQL (Neon)
        │
        └──►  API Brevo (emails)      ┌── @3d-dice/dice-box (animation 3D, côté client)
```

## 2. Découpage en couches (indépendantes)

| Couche | Emplacement | Responsabilité |
|---|---|---|
| **Présentation** | `apps/web/src` (React) | IHM, état local, rendu, animation des dés |
| **Communication** | `apps/web/src/lib/api.ts` | Client HTTP unique (`apiFetch`), gestion des erreurs et des cookies |
| **API / Contrôleurs** | `apps/server/src/routes/*` | Endpoints Express, validation d'entrée, orchestration |
| **Middleware transverse** | `apps/server/src/middleware/*` | Authentification (`attachAuth`/`requireAuth`), rate limiting |
| **Métier / utilitaires** | `apps/server/src/lib/*` | Règles réutilisables : `password`, `session`, `characterStats`, `http`, `sseHub`, `mailer` |
| **Accès aux données** | `apps/server/src/lib/prisma.ts` + Prisma | Persistance découplée du SGBD, requêtes paramétrées |
| **Données** | `apps/server/prisma/schema.prisma` + migrations | Modèle, contraintes d'intégrité |

**Principe appliqué :** une couche ne connaît que la couche immédiatement inférieure. La
présentation ignore le SGBD ; les routes ignorent le SQL (Prisma) ; le métier réutilisable
(`lib/`) est indépendant d'Express.

## 3. Justification des choix (normes / méthodes)

- **Séparation des responsabilités (SoC)** et **couplage faible** : chaque module a une raison
  de changer unique.
- **REST** pour l'API (verbes HTTP, codes statut normalisés via `HttpError`).
- **Requêtes paramétrées systématiques** (Prisma) → pas d'injection SQL.
- **Stateless côté HTTP** (session portée par un cookie + table `Session`) → horizontalement
  scalable.
- **Temps réel par SSE** (et non WebSocket) : plus simple, unidirectionnel serveur→client,
  suffisant pour la diffusion d'événements, compatible avec l'hébergement mono-service.

## 4. Intégration dans le SI (urbanisation)

- **Point d'entrée unique** : un domaine, un service. Facilite le déploiement et la supervision.
- **Frontières nettes** : l'API `/api/*` est la seule surface d'échange ; le front est un client
  parmi d'autres possibles (une app mobile pourrait consommer la même API).
- **Évolutivité** : l'ajout d'un domaine se fait par un nouveau `Router` monté dans `app.ts`,
  sans toucher aux autres (ouvert/fermé). Exemple concret : l'ajout du domaine « échange de
  données » (`dataExchange`) se branche en une ligne.
- **Extraction possible** : le dossier `lib/` regroupe des briques mutualisables qui pourraient
  devenir un package partagé si le SI grandit.

## 5. Intégration de composants hétérogènes et services externes (C29)

| Composant | Type | Rôle | Intégration |
|---|---|---|---|
| **Prisma** | ORM | Accès données typé | `lib/prisma.ts` (singleton) |
| **PostgreSQL / Neon** | SGBD managé | Persistance | via `DATABASE_URL` |
| **Brevo** | Service email externe (HTTP) | Mails de bienvenue et de reset | `lib/mailer.ts` (échec non bloquant) |
| **@3d-dice/dice-box** | Librairie front | Animation 3D des dés (décorative) | import dynamique dans `LiveCampaign.tsx` |
| **SSE** | Protocole temps réel | Diffusion d'événements | `lib/sseHub.ts` |
| **Render + cron-job.org** | PaaS + planificateur | Hébergement + anti-veille | `render.yaml` |

**Robustesse d'intégration** : les services externes non critiques sont **tolérants à la panne**
(ex. l'envoi d'email échoue silencieusement sans casser l'inscription ; l'animation 3D indisponible
n'empêche pas le jet, résolu côté serveur).

**RSE** : voir `16-interface-echange-donnees.md` §RSE (choix d'un hébergement mutualisé sobre,
plan gratuit basse consommation, pas de sur-dimensionnement, dépendances limitées).

## 6. Schéma de déploiement

```
GitHub (main) ──(push)──► Render build (npm install → prisma generate → build → migrate deploy → seed)
                                   │
                                   ▼
                        Service web unique (Frankfurt)
                                   │
                         DATABASE_URL │ (sslmode=require)
                                   ▼
                          Neon PostgreSQL (Frankfurt)
```

> **Validation chef de projet** : ce schéma est destiné à être contresigné (case à cocher du
> référentiel C15) — acte humain.
