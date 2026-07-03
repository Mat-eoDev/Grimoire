# Gestion de projet Agile — backlog, ADR, planning & suivi

*Compétences visées : C16 (choix de réutilisation / ADR), C17 (planification, estimation), C18 (Agile, backlog, sprints), C31 (suivi de disponibilité, comptes-rendus d'activité).*

## 1. Cadre de travail

Méthode **Agile / Kanban-Scrum léger** sur GitHub : chaque incrément = une **branche de
fonctionnalité** → **Pull Request** revue → merge. La circulation est tracée par 21 PR
numérotées (#1 → #21), du **2026-03-12** au **2026-07-03**.

## 2. Product backlog (extrait priorisé)

| ID | User story | Priorité | Statut | Livré par |
|---|---|---|---|---|
| US-01 | Régie de partie en direct (scène live MJ) | Must | ✅ | PR #1 |
| US-02 | Contexte visuel / décors | Must | ✅ | PR #2 |
| US-03 | Déploiement app unique (Render) | Must | ✅ | PR #3 |
| US-04 | Lobby & personnages, notes privées | Must | ✅ | PR #4, #5 |
| US-05 | Rejoindre par code de partie | Must | ✅ | PR #5 |
| US-06 | Emails (bienvenue, reset mot de passe) | Should | ✅ | PR #6, #7 |
| US-07 | Combat : PV, attaques PNJ/ennemi | Must | ✅ | PR #8, #9, #11 |
| US-08 | Jets de dés à conséquences + résolution | Must | ✅ | PR #11, #12 |
| US-09 | Mort à 0 PV, soin, personnage à terre | Must | ✅ | PR #13, #14 |
| US-10 | Inventaire & échanges entre joueurs | Should | ✅ | (branches inventory/trade) |
| US-11 | Durcissement sécurité complet | Must | ✅ | PR #15–#21 |
| US-12 | Import/export de campagne (échange de données) | Should | ✅ | (branche docs/data-exchange) |
| US-13 | Journal/historique de campagne | Could | ⏳ Backlog | — |
| US-14 | Action joueur autonome en combat | Could | ⏳ Backlog | — |

## 3. Découpage en sprints (traces réelles)

| Sprint | Thème | PR | Résultat |
|---|---|---|---|
| **S0** — Socle & MVP live | Régie live, front stable, déploiement | #1, #2, #3 | App déployée, scène temps réel |
| **S1** — Onboarding & comptes | Lobby, code de partie, emails, reset | #4, #5, #6, #7, #10 | Parcours d'entrée complet |
| **S2** — Combat | PV, attaques, jets, mort/soin, à terre | #8–#14 | Boucle de jeu jouable |
| **S3** — Sécurité (DevSecOps) | Audit + 6 correctifs + déploiement | #15–#21 | Application durcie en prod |

## 4. Décisions d'architecture (ADR) & choix de réutilisation (C16)

| ADR | Décision | Alternative écartée | Justification |
|---|---|---|---|
| ADR-01 | **Prisma** (ORM) | SQL brut / autre ORM | Requêtes paramétrées, typage, migrations versionnées — **réutilisation totale** d'un composant éprouvé |
| ADR-02 | **SSE** pour le temps réel | WebSocket | Unidirectionnel suffisant, plus simple, compatible mono-service — **réutilisation** d'un standard natif |
| ADR-03 | **App unique** (Express sert React) | Front/back séparés | Même origine → pas de CORS/cookies, déploiement simple |
| ADR-04 | **Rate limiter maison** | dépendance `express-rate-limit` | **Écriture neuve** minimale : évite une dépendance pour un besoin simple sur mono-instance |
| ADR-05 | **Brevo** (email HTTP) | SMTP auto-hébergé | **Réutilisation** d'un service managé, échec non bloquant |
| ADR-06 | **Render + Neon (free)** | VPS auto-géré | Coût nul, CI de déploiement intégrée, adapté à la cible |

Ces ADR illustrent l'arbitrage **réutilisation totale / partielle / écriture neuve** exigé par C16.

## 5. Planning prévisionnel vs réalisé (C17)

| Phase | Prévu | Réalisé | Écart |
|---|---|---|---|
| Conception & MVP | Mars | Mars (S0) | conforme |
| Fonctionnel (auth, combat) | Avril–Juin | Avril–Juin (S1–S2) | conforme |
| Durcissement & dossier | Juillet | Juillet (S3) | conforme |

**Estimation** : chaque US a été dimensionnée en complexité relative (t-shirt sizing) ; la
cadence observée (≈ 21 PR sur ~4 mois en disponibilité partielle) sert de **vélocité de
référence** pour estimer les US restantes (US-13, US-14).

## 6. Suivi de disponibilité & comptes-rendus d'activité (C31)

- **Outil de suivi** : GitHub (PR = unité de travail, historique horodaté = journal d'activité).
- **État de disponibilité** : projet mené en disponibilité partielle (alternance/formation) ;
  la répartition des dates de commits reflète cette cadence.
- **Compte-rendu d'activité type** (par sprint) :
  ```
  Sprint Sx — période
  Réalisé : PR #.. (résumé)
  Blocages : …
  Reste à faire : …
  Disponibilité effective : … j/homme
  ```
Les PR fusionnées constituent la **preuve d'avancement** renseignée dans l'outil de suivi.
