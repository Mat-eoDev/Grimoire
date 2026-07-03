# Analyse de risques sécurité — Grimoire

*Compétences visées : C8 (identification et criticité des risques, prévention, DevSecOps), C32 (analyse d'impact).*

> Ce document formalise l'audit de sécurité réalisé sur le code déployé et les correctifs
> appliqués (PR #15 à #20, en production le 2026-07-03).

## 1. Méthode

Audit statique et dynamique de l'ensemble des phases : authentification, sessions, autorisations,
injections, XSS, dépendances, échanges de données, déploiement. Cotation par **matrice
criticité = f(probabilité, impact)** (échelle 1–4), puis plan de prévention. Approche
**DevSecOps** : correctifs intégrés au flux Git (branche → PR → develop → main), vérifiés par
`tsc`/tests/build avant déploiement.

Échelle : Probabilité (1 rare → 4 fréquent) × Impact (1 mineur → 4 critique) = **Criticité** (1–16).

## 2. Formulaire d'identification des risques

| ID | Risque | Actif menacé | Prob. | Impact | Criticité | Statut |
|---|---|---|---|---|---|---|
| R1 | Dépendances vulnérables (express, react-router, vite, qs) | Intégrité/dispo | 3 | 3 | **9** | ✅ Corrigé (npm audit fix) |
| R2 | Triche : résultat de dé imposé par le client | Intégrité métier | 4 | 3 | **12** | ✅ Corrigé (tirage serveur) |
| R3 | Bruteforce mot de passe (login sans limite) | Confidentialité | 3 | 4 | **12** | ✅ Corrigé (rate limit) |
| R4 | Email-bombing via reset (spam Brevo) | Dispo / coût | 3 | 2 | **6** | ✅ Corrigé (rate limit) |
| R5 | Duplication d'objets (race TOCTOU sur échanges) | Intégrité données | 2 | 3 | **6** | ✅ Corrigé (transaction atomique) |
| R6 | Énumération d'emails par timing du login | Confidentialité | 2 | 2 | **4** | ✅ Corrigé (temps constant) |
| R7 | DoS par entrée géante (scrypt / stockage) | Disponibilité | 2 | 3 | **6** | ✅ Corrigé (bornes de taille) |
| R8 | Énumération des codes de partie | Confidentialité | 2 | 2 | **4** | ✅ Atténué (rate limit join) |
| R9 | Injection SQL | Intégrité/confid. | 1 | 4 | **4** | ✅ Nul (Prisma paramétré) |
| R10 | XSS stocké/réfléchi | Confidentialité | 1 | 3 | **3** | ✅ Nul (React échappe, `<img src>`) |
| R11 | Absence de rotation/purge de session | Confidentialité | 2 | 2 | **4** | 🟡 Résiduel (durcissement futur) |
| R12 | Absence de jeton CSRF (défense en profondeur) | Intégrité | 1 | 2 | **2** | 🟡 Résiduel (SameSite=Lax en place) |

## 3. Matrice criticité (synthèse)

```
Impact →      1        2        3        4
Prob ↓
  4                            R2*
  3                   R4      R1*,R3*
  2         R6*,R8*  R11,R12  R5*,R7*   R9*
  1                   R10*    R10       R9*
```
`*` = traité. Aucun risque de criticité ≥ 9 ne subsiste ouvert.

## 4. Plan de prévention

**Mesures appliquées (préventives et détectives)**
1. **Contrôle des dépendances** : `npm audit` intégré au cycle ; mise à jour semver-safe.
2. **Rate limiting** par IP sur les endpoints sensibles (auth, join).
3. **Autorisation systématique** (gardes `require*`) et cloisonnement par `campaignId`.
4. **Secrets hors dépôt** (`.env` ignoré, variables Render `sync:false`).
5. **Cookies HttpOnly + Secure (prod) + SameSite=Lax**, tokens de session hachés en base.
6. **Validation d'entrée bornée** partout ; bornes de taille anti-DoS.
7. **Intégrité au plus près de la donnée** : contraintes + trigger (voir `04-modele-donnees.md`).

**Risques résiduels suivis (backlog sécurité)**
- R11 : ajouter rotation de session à la connexion + purge périodique (cron).
- R12 : ajouter un contrôle d'en-tête `Origin`/`Sec-Fetch-Site` en défense en profondeur.

## 5. Analyse d'impact (C32)

Chaque correctif a été évalué pour son impact avant intégration :
- **Aucun changement de schéma** → aucune migration, aucun risque pour les données Neon.
- **Compatibilité API préservée** (dépendances mises à jour en semver-compatible).
- **Vérification comportementale post-déploiement** : le rate limiting renvoie bien `429` en
  production (preuve de la bonne version déployée).

## 6. Traçabilité DevSecOps

| Risque | Correctif | Preuve |
|---|---|---|
| R1 | `fix/deps-audit` | PR #15 |
| R3, R4, R8 | `fix/auth-rate-limit` | PR #16 |
| R5 | `fix/trade-transaction` | PR #17 |
| R6 | `fix/login-timing` | PR #18 |
| R7 | `fix/input-validation` | PR #19 |
| R2 | `fix/dice-roll` | PR #20 |
