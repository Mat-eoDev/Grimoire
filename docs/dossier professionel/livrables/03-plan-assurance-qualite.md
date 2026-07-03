# Plan d'Assurance Qualité (PAQ) & Charte de nommage — Grimoire

*Compétences visées : C2 (PAQ), C9 (code lisible/maintenable, charte de nommage, réutilisation).*

## 1. Objectif qualité

Livrer un logiciel **lisible, maintenable, robuste et fiable**. Le PAQ définit les règles que
tout code du projet doit respecter et les contrôles qui les font appliquer.

## 2. Environnement et outils

| Domaine | Outil | Rôle |
|---|---|---|
| Langage | **TypeScript** (strict) | Typage statique, sûreté |
| Analyse statique | `tsc --noEmit` (`npm run check`) | Détection d'erreurs à la compilation |
| Tests | `node:test` / `tsx` | Tests unitaires serveur |
| Formatage | Prettier + ESLint (devcontainer) | Style homogène |
| Build | `tsc` (serveur), Vite (front) | Artefacts livrables |
| Données | Prisma migrate | Schéma versionné |
| CI implicite | GitHub PR + Render build | Barrière avant intégration/déploiement |

## 3. Charte de nommage (appliquée dans le code)

| Élément | Convention | Exemple réel |
|---|---|---|
| Fichiers TS/utilitaires | `camelCase.ts` | `characterStats.ts`, `sseHub.ts` |
| Composants React | `PascalCase.tsx` | `LiveCampaign.tsx`, `CharacterSheet.tsx` |
| Variables / fonctions | `camelCase`, verbe en tête pour les actions | `createSession`, `verifyPassword`, `requireGmCampaign` |
| Types / classes / enums | `PascalCase` | `HttpError`, `MemberRole`, `ActionRollStatus` |
| Constantes | `SCREAMING_SNAKE_CASE` ou `camelCase` selon la portée | `KEY_LENGTH`, `DUMMY_PASSWORD_HASH` |
| Endpoints REST | `/domaine/:id/ressource`, kebab pour les mots composés | `/campaigns/:campaignId/scene-elements` |
| Modèles Prisma | `PascalCase` singulier ; champs `camelCase` | `CampaignMember.joinedAt` |

**Règles transverses** : un identifiant décrit l'intention, pas le type ; les fonctions de garde
d'autorisation commencent par `require*` (`requireAuth`, `requireCampaignMember`, `requireGm`).

## 4. Réutilisation (mutualisation)

Le dossier `apps/server/src/lib/` regroupe des **briques réutilisées par plusieurs domaines** :

| Brique | Réutilisée par |
|---|---|
| `http.ts` (`assertString`, `optionalString`, `HttpError`, cookies) | auth, campaigns, inventory, trades |
| `session.ts` (création/résolution/destruction de session) | auth, middleware |
| `password.ts` (hash/vérif temps constant) | auth |
| `prisma.ts` (client singleton) | toutes les routes |
| `sseHub.ts` (abonnement/diffusion) | campaigns, trades |
| `characterStats.ts` (stats de base par classe) | campaigns |

Côté front, `apiFetch` centralise **tous** les appels réseau (un seul point pour les cookies, les
erreurs, le `Content-Type`).

## 5. Règles de codage (extrait)

1. **Toute entrée externe est validée** avant usage (`assertString`, bornes de taille, enums whitelistées).
2. **Toute route protégée** appelle une garde d'autorisation avant tout accès aux données.
3. **Aucun SQL brut** : accès exclusivement via Prisma (paramétré).
4. **Gestion d'erreurs centralisée** : les handlers `throw new HttpError(...)`, un middleware final
   formate la réponse et journalise les erreurs inattendues (`console.error`).
5. **Effets de bord réseau non bloquants** pour les services non critiques (email).
6. **Commentaires utiles** : on commente le *pourquoi* (contrainte, invariant), pas le *quoi*.

## 6. Indicateurs qualité (statistiques)

À exécuter et à joindre le jour du rendu :

```bash
# Volumétrie du code source (hors dépendances / assets)
find apps -name '*.ts' -o -name '*.tsx' | grep -v node_modules | xargs wc -l | tail -1
# Contrôle statique (doit être vert)
npm run check
# Tests (doivent être verts)
npm --workspace @newmj/server test
```

Résultats attendus : `tsc` sans erreur, tests au vert. Taux de réutilisation illustré par la
table §4 (les 6 briques `lib/` sont chacune consommées par ≥ 1 domaine, `http.ts` par les 4).

## 7. Note sur l'approche objet (C9)

Le style dominant est **modulaire/fonctionnel** (modules à responsabilité unique), complété par
des **types et classes** là où l'objet apporte de la valeur (`class HttpError extends Error`,
énumérations Prisma comme types métier). L'encapsulation des règles métier est assurée par les
modules `lib/` et les gardes `require*` plutôt que par une hiérarchie de classes — choix assumé
pour un backend Node léger. Voir `05-services-metier-regles.md`.
