# Interface d'échange de données — Grimoire

*Compétences visées : C33 (analogies/différenciations, table de correspondance, pas de référence orpheline), C34 (agrégation/consolidation, RGPD), C35 (import/export, formats compatibles, flux synchrones/asynchrones), C29 (RSE).*

## 1. Interface réalisée

Deux endpoints d'échange **réels et fonctionnels** (`apps/server/src/routes/dataExchange.ts`) :

| Endpoint | Sens | Flux | Format |
|---|---|---|---|
| `GET /api/campaigns/:campaignId/export` | Sortie | **Synchrone** (requête/réponse, téléchargement) | JSON (`application/json`, `Content-Disposition: attachment`) |
| `POST /api/campaigns/import` | Entrée | **Synchrone** | JSON |
| `GET /api/campaigns/:campaignId/stream` | Sortie | **Asynchrone** (SSE, flux continu) | `text/event-stream` |

L'application couvre donc **les deux régimes** exigés par C35 : synchrone (import/export) et
asynchrone (diffusion temps réel SSE).

## 2. Format d'échange (contrat)

Document versionné, autoportant :
```json
{
  "format": "grimoire.campaign",
  "version": 1,
  "exportedAt": "2026-07-03T...Z",
  "campaign": { "title", "status", "scenePreset", "sceneTitle", "sceneText" },
  "members":  [{ "ref": 0, "username": "...", "role": "GM|PLAYER" }],
  "characters":[{ "memberRef": 0, "charId", "charName", "hp", "maxHp", ... }],
  "sceneElements":[{ "type", "name", "hp", "maxHp", "posX", "posY", ... }],
  "inventory":[{ "memberRef": 0, "itemSlug", "quantity", "equipped", ... }],
  "summary": { "memberCount", "characterCount", "sceneElementCount", "inventoryItemCount", "averageHp" }
}
```

## 3. Table de correspondance / mapping (C33)

Aucune référence interne (UUID) n'est exportée. On construit une **table de correspondance**
`userId → ref` (index stable). Les entités liées (personnages, inventaire) référencent le
membre par `memberRef`, garantissant **aucune référence orpheline** dans le fichier.

| Modèle source (interne) | Champ interne | Champ exporté | Règle |
|---|---|---|---|
| `User` | `id` (UUID) | `members[].ref` (index) | pseudonymisation |
| `CharacterSheet` | `userId` | `characters[].memberRef` | via table de correspondance |
| `InventoryEntry` | `userId`, `itemId` | `memberRef`, `itemSlug` | l'objet est désigné par son **slug** stable, pas son UUID |
| `SceneElement` | `campaignId` | (implicite) | rattaché à la campagne importée |

À l'import, le mapping **cible** est explicite : la méta de campagne et les éléments de scène
(non nominatifs) sont recréés ; l'importateur devient le MJ. Les données liées à des joueurs
réels absents ne sont **pas** recréées (choix documenté, voir §5).

## 4. Agrégation / consolidation (C34)

Le bloc `summary` contient des **données produites par calcul** (absentes du modèle) :
`memberCount`, `characterCount`, `sceneElementCount`, `inventoryItemCount` (somme des quantités),
`averageHp` (moyenne consolidée des PV). C'est une donnée **indisponible telle quelle** dans la
base, générée à l'export. (Autre exemple d'agrégation métier : `lib/characterStats.ts` dérive les
stats de base ; `GET /inventory/all` consolide les inventaires par joueur pour le MJ.)

## 5. RGPD (C34)

Décisions de conformité intégrées à l'export/import :
- **Minimisation** : l'export ne contient **ni email, ni hash de mot de passe, ni identifiant
  technique** — uniquement le **pseudo public** et des données de jeu.
- **Pseudonymisation** : les personnes sont désignées par un index (`ref`), pas par leur identité.
- **Finalité** : l'import ne recrée pas de comptes ni de données personnelles d'autrui (pas de
  ré-association de joueurs réels) → pas de traitement de données personnelles de tiers.
- **Contrôle d'accès** : seul le **MJ** peut exporter sa campagne.

## 6. RSE (C29)

Choix sobres : hébergement mutualisé bas de gamme (Render/Neon free), **pas de sur-provisionnement**,
dépendances limitées et à jour, formats texte légers (JSON) pour les échanges, mise en veille de
l'instance hors usage. L'export permet en outre la **portabilité** des données (réversibilité),
principe de bonne gouvernance numérique.

## 7. Exemples d'usage

```bash
# Export (MJ authentifié)
curl -b cookies.txt https://grimoire-q9hj.onrender.com/api/campaigns/<id>/export -o campagne.json

# Import (crée une nouvelle campagne dont on devient MJ)
curl -b cookies.txt -X POST https://grimoire-q9hj.onrender.com/api/campaigns/import \
  -H "Content-Type: application/json" --data @campagne.json
```
