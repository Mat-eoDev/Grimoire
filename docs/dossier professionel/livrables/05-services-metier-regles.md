# Services métier & règles encapsulées — Grimoire

*Compétences visées : C3 (règles métier isolées, briques réutilisables), C4 (services d'accès aux données).*

## 1. Cartographie des services métier

Le métier est organisé par **domaines** (routers Express) qui s'appuient sur des **briques
réutilisables** (`lib/`) et une **couche d'accès aux données** unique (Prisma). Chaque domaine
expose des règles encapsulées derrière des gardes d'autorisation.

| Domaine (router) | Responsabilité métier | Briques réutilisées |
|---|---|---|
| `auth` | Comptes, sessions, reset mot de passe | `password`, `session`, `http`, `mailer`, rate limit |
| `campaigns` | Campagnes, membres, scène live, jets de dés | `characterStats`, `sseHub`, `http`, rate limit |
| `inventory` | Objets, équipement, consommables | `http` |
| `trades` | Échanges/dons entre joueurs | `sseHub`, `http` |

## 2. Règles métier encapsulées (exemples)

### Autorisation (gardes réutilisables)
- `requireAuth(request)` — exige une session valide.
- `requireCampaignMember(campaignId, userId)` — exige l'appartenance à la campagne.
- `requireGmCampaign(campaignId, userId)` — exige le rôle MJ **et** une campagne `ACTIVE`.

Ces gardes **centralisent** la règle d'accès : aucune route ne lit de données sans être passée
par l'une d'elles. C'est la mutualisation d'une règle métier critique (cloisonnement par campagne).

### Combat / jets de dés (`ActionRoll`)
- **Une seule demande active** par campagne à la fois (invariant vérifié à la création).
- Seuils validés : `1 ≤ totalFailureMax < successMin ≤ totalSuccessMin ≤ dieSides`.
- **Tirage serveur** exclusif (le client ne peut pas imposer son résultat).
- **Personnage à terre** (0 PV) : ne peut ni être demandeur ni lanceur tant qu'il n'est pas soigné.
- **Résolution** : selon l'issue (`getRollOutcome`), applique la conséquence encapsulée
  (`DAMAGE_TARGET`, `DAMAGE_PLAYER`, `HEAL_PLAYER`, `DELETE_TARGET`, `NARRATION`), PV bornés
  dans `[0, maxHp]`.

### Statistiques de personnage (`lib/characterStats.ts`)
- `getBaseStats(charId)` encapsule la **table des stats de base par classe** — brique métier pure,
  testable et réutilisable, indépendante du transport HTTP et du stockage.

### Échanges (`trades`)
- Transfert **atomique** (transaction + décréments conditionnels) : jamais de duplication.
- On ne peut offrir/donner que ce qu'on possède réellement (revérifié dans la transaction).

## 3. Briques réutilisables (bibliothèque de fonctions métier)

| Fonction | Fichier | Contrat |
|---|---|---|
| `hashPassword` / `verifyPassword` / `verifyPasswordOrDummy` | `lib/password.ts` | Hachage scrypt + sel, comparaison à temps constant |
| `createSession` / `resolveSession` / `destroySessionById` | `lib/session.ts` | Cycle de vie d'une session (token haché) |
| `assertString` / `optionalString` / `requireArray` / `optionalNumber` | `lib/http.ts` | Validation d'entrée bornée |
| `getBaseStats` | `lib/characterStats.ts` | Stats de base par classe |
| `sseBroadcast` / `sseSubscribe` / `sseUnsubscribe` | `lib/sseHub.ts` | Diffusion temps réel par campagne |
| `sendWelcomeEmail` / `sendPasswordResetEmail` | `lib/mailer.ts` | Emails transactionnels tolérants à la panne |

**Robustesse / mutualisation** : ces fonctions sont sans dépendance à Express (sauf helpers de
cookie), donc réutilisables dans un autre contexte (script, worker, future API mobile).

## 4. Services d'accès aux données (C4)

- Toutes les lectures/écritures passent par le **Prisma Client** partagé (`lib/prisma.ts`).
- Les opérations composées et sensibles sont encapsulées dans des **transactions**
  (`prisma.$transaction`) : reset de mot de passe (mise à jour + purge tokens + révocation
  sessions), acceptation d'échange (claim + transferts + annulation en cascade).
- Le **découplage** permet de tester la logique métier en substituant le client si besoin, et
  d'isoler tout changement de SGBD dans une seule couche.
