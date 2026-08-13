# Recette & mise en exploitation (ITIL) — Grimoire

*Compétences visées : C19 (recette, PV de réception, validation client, CFTL), C21 (intégrabilité d'un correctif, mise en exploitation, ITIL, SLA).*

## 1. Critères de recette (CFTL)

La recette valide que le livrable répond aux spécifications (`01-cahier-…`). Chaque critère est
**objectif et rejouable**.

| Réf | Critère | Méthode | Attendu |
|---|---|---|---|
| RC-01 | Inscription/connexion fonctionnelles | Scénario T-AUTH-01/03 | Session créée / rejet propre |
| RC-02 | Reset mot de passe | T-AUTH-04 | Lien unique, sessions révoquées |
| RC-03 | Rejoindre une partie par code | T-CAMP-01 | Membre ajouté / erreurs cadrées |
| RC-04 | Jet de dé intègre | T-DICE-01/02 | Tirage serveur, client ignoré |
| RC-05 | Échange sans duplication | T-TRADE-01 | Transfert unique, 409 concurrent |
| RC-06 | Temps réel | T-RT-01 | Événement < 1 s |
| RC-07 | Sécurité (rate limit) | Sonde prod | `429` après seuil |
| RC-08 | Qualité technique | `check` + tests | Vert |

## 2. Procès-verbal de réception (modèle à signer)

```
PROCÈS-VERBAL DE RECETTE — Projet Grimoire
Version livrée : ____   Date : ____
Périmètre recetté : RC-01 … RC-08
Résultat : [ ] Conforme  [ ] Conforme avec réserves  [ ] Non conforme
Réserves / anomalies : ______________________________________
Le client / formateur (nom, signature) : ____________________
Le développeur (nom, signature) : ___________________________
```
> La **signature du client/formateur** est un acte humain ; les critères et le PV sont fournis
> prêts à l'emploi.

## 3. Procédure d'intégrabilité d'un correctif (ITIL)

Flux réellement appliqué pour les 6 correctifs de sécurité :

```
Branche fix/*  →  PR (revue)  →  develop (intégration)  →  PR develop→main  →  build Render  →  prod
     │                │                  │                        │                 │
  tests/check     validation         non-régression          bon à intégrer     migrate deploy
```

### Checklist de mise en exploitation (bon à intégrer)
- [x] `npm run check` vert (analyse statique serveur + web)
- [x] `npm --workspace @newmj/server test` vert
- [x] Build complet (`npm run build`) réussi
- [x] Simulation d'intégration sans conflit (merge des branches rejoué)
- [x] Revue de PR effectuée
- [x] Impact base de données évalué (aucune migration destructive ; migrations `deploy` idempotentes)
- [x] Rollback possible (revert de PR + redeploiement)
- [x] Vérification post-déploiement (sonde comportementale `429`)

## 4. SLA / disponibilité (équivalent)

| Indicateur | Cible | Moyen |
|---|---|---|
| Disponibilité | *best-effort* (plan free) | Ping cron `/health` toutes les 5 min (anti-veille) |
| Point de contrôle santé | `GET /health` → 200 `{status:"ok"}` | Supervisable |
| Temps de rétablissement | redeploiement < ~10 min | Build Render automatisé |
| Sauvegarde données | gérée par Neon (managé) | — |

## 5. Environnement de test / pré-production

- **Local** : `docker-compose.yml` (PostgreSQL) + `.devcontainer/` (environnement reproductible)
  → équivalent d'un environnement de test isolé (voir `17-environnement-et-scripts.md`).
- **Intégration** : branche `develop` (protégée, merge par PR) fait office de pré-production
  logique avant promotion vers `main` (production).

> Preuve de mise en exploitation réelle : le déploiement du 2026-07-03 (PR #21) a été suivi d'une
> vérification en production concluante.


## Barrière d'intégration automatisée

Depuis la PR #32, toute pull request déclenche le workflow `ci.yml` : installation
reproductible (`npm ci`), génération du client Prisma, `tsc --noEmit` sur le serveur et sur le
front, exécution des 24 tests unitaires, build complet, puis `npm audit` bloquant sur les
dépendances de production au niveau `high`.

Avant cela, le dépôt ne comportait qu'un workflow de maintien en éveil de l'hébergement :
ni les tests ni le typage ne s'exécutaient avant un merge, et seule une erreur de compilation
était rattrapée — tardivement — par le build de déploiement.
