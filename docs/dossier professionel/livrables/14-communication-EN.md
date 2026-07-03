# Professional communication (FR / EN) — Grimoire

*Compétence visée : C23 (communication professionnelle en français et en anglais).*

## 1. Executive summary (EN)

**Grimoire** is a web application that assists tabletop role-playing Game Masters (GM). It
centralises, in real time, the management of a campaign: scene composition, characters, dice
rolls with automatic consequences, inventory and player-to-player trading. The GM keeps full
narrative control while being relieved of bookkeeping.

**Tech stack.** Node.js + Express + Prisma + PostgreSQL (backend), React + Vite (frontend),
Server-Sent Events for real-time updates, HttpOnly cookie sessions. Single-service deployment on
Render with a managed Neon PostgreSQL database.

**Security.** A full audit identified and rated 12 risks; all high-criticality items were fixed
(dependency vulnerabilities, brute-force protection, atomic trades, server-side dice rolls,
input size limits, constant-time login). Fixes were shipped through a Git branch → PR → integration
→ production workflow.

## 2. Glossaire technique bilingue (FR / EN)

| Français | English |
|---|---|
| Maître du Jeu (MJ) | Game Master (GM) |
| Campagne | Campaign |
| Jet de dé | Dice roll |
| Conséquence | Consequence / outcome effect |
| Point de vie (PV) | Hit points (HP) |
| Inventaire / échange | Inventory / trade |
| Couche d'accès aux données | Data access layer |
| Limitation de débit | Rate limiting |
| Temps réel (SSE) | Real-time (Server-Sent Events) |
| Contrainte d'intégrité | Integrity constraint |

## 3. API endpoints (EN reference — extract)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Start a session |
| POST | `/api/campaigns` | Create a campaign |
| POST | `/api/campaigns/join` | Join with a code |
| GET | `/api/campaigns/:id` | Role-filtered campaign state |
| POST | `/api/campaigns/:id/action-rolls` | Request a dice roll (GM) |
| GET | `/api/campaigns/:id/stream` | Real-time event stream (SSE) |
| GET | `/api/campaigns/:id/export` | Export campaign as JSON |
| POST | `/api/campaigns/import` | Import a campaign from JSON |

## 4. Sample commit message convention (EN/FR)

The project uses **Conventional Commits** (`feat`, `fix`, `docs`, `chore`) with a scope, e.g.
`fix(trades): atomic inventory transfers`. This keeps history readable for both French and
English-speaking reviewers.

*(Une version anglaise du README est fournie : `README.en.md`.)*
