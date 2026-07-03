# Cahier des spécifications fonctionnelles — Grimoire

*Compétences visées : C1 (spécifications), C11 (procédures utilisateurs), C22 (recueil du besoin).*

## 1. Étude de l'existant

**Constat métier.** L'animation d'une partie de jeu de rôle sur table repose aujourd'hui sur
des supports dispersés : fiches papier, notes du Maître du Jeu (MJ), dés physiques, images
imprimées. Le MJ jongle entre la narration, la gestion des points de vie, la visibilité des
informations (ce que les joueurs ont le droit de voir) et l'arbitrage des actions.

**Problèmes identifiés.**
- Perte de temps à recopier / recalculer les statistiques et points de vie.
- Difficulté à ne révéler une information qu'au bon moment.
- Aucune trace centralisée de la campagne, de l'inventaire, des échanges entre joueurs.
- Le distanciel (joueurs à distance) n'est pas supporté par le papier.

**Solution retenue.** Une application web centralisée, temps réel, où le MJ pilote la scène,
les jets de dés et les récompenses, et où chaque joueur dispose de sa fiche, son inventaire et
une vue synchronisée de la scène.

## 2. Acteurs et rôles

| Acteur | Rôle | Droits principaux |
|---|---|---|
| **Visiteur** | Non authentifié | S'inscrire, se connecter, réinitialiser son mot de passe |
| **Joueur** (`MemberRole.PLAYER`) | Participe à une campagne | Créer/consulter sa fiche, gérer son inventaire, lancer les dés demandés, échanger des objets, prendre des notes privées |
| **Maître du Jeu** (`MemberRole.GM`) | Crée et pilote la campagne | Tout ce qui précède + piloter la scène, créer ennemis/PNJ/objets, demander/résoudre les jets, distribuer des objets, lancer/arrêter la partie |

Un même `User` peut être MJ dans une campagne **et** joueur dans une autre (rôle porté par `CampaignMember`, pas par le compte).

## 3. Besoins fonctionnels (recueil)

Exprimés en récits utilisateurs, priorisés MoSCoW.

- **En tant que MJ**, je veux créer une campagne et obtenir un **code de partie** à transmettre, afin que mes joueurs la rejoignent sans configuration. *(Must)*
- **En tant que joueur**, je veux rejoindre une campagne avec un code, afin d'entrer en un geste. *(Must)*
- **En tant que joueur**, je veux créer un personnage (classe + stats de base) et consulter sa fiche à jour. *(Must)*
- **En tant que MJ**, je veux composer une scène (décor, ennemis, PNJ, objets, narration) et **contrôler leur visibilité** joueur par joueur. *(Must)*
- **En tant que MJ**, je veux **demander un jet de dé** à un joueur avec des seuils (échec total / échec / réussite / réussite totale) et des **conséquences automatiques** (dégâts, soin, suppression, narration). *(Must)*
- **En tant que joueur**, je veux lancer le dé demandé et voir le résultat et sa conséquence en temps réel. *(Must)*
- **En tant que joueur**, je veux gérer mon inventaire (équiper, utiliser un consommable) et **échanger des objets** avec un autre joueur (offre / acceptation). *(Should)*
- **En tant que participant**, je veux que la scène et les événements se mettent à jour **en temps réel** sans recharger. *(Must)*
- **En tant que visiteur**, je veux réinitialiser mon mot de passe par email. *(Should)*

## 4. Spécifications fonctionnelles détaillées (traçabilité)

| ID | Fonctionnalité | Règles | Endpoint(s) réel(s) | Modèle |
|---|---|---|---|---|
| SF01 | Inscription | email+pseudo uniques, mot de passe ≥ 8, hash scrypt | `POST /api/auth/register` | `User` |
| SF02 | Connexion / session | cookie HttpOnly, token aléatoire haché SHA-256, 7 j | `POST /api/auth/login`, `/logout`, `GET /me` | `Session` |
| SF03 | Reset mot de passe | token à usage unique, expiration 1 h, révocation des sessions | `/forgot-password`, `/reset-password` | `PasswordResetToken` |
| SF04 | Créer une campagne | code unique généré, MJ = créateur | `POST /api/campaigns` | `Campaign`, `CampaignMember` |
| SF05 | Rejoindre par code | campagne non close, upsert du membre | `POST /api/campaigns/join` | `CampaignMember` |
| SF06 | Consulter la campagne | payload filtré selon le rôle (visibilité) | `GET /api/campaigns/:id` | agrégat |
| SF07 | Fiche personnage | stats de base par classe (`getBaseStats`) | `POST/GET /campaigns/:id/character` | `CharacterSheet` |
| SF08 | Scène live | preset/titre/texte, éléments positionnés (drag), visibilité | `PUT /live-scene`, `POST/PATCH/DELETE /scene-elements` | `SceneElement`, `RevelationAsset` |
| SF09 | Jets de dés à conséquences | seuils validés, une demande active à la fois, tirage **serveur** | `POST /action-rolls`, `/:id/roll`, `/reroll`, `/cancel`, `/resolve` | `ActionRoll` |
| SF10 | Prêt / lancement / arrêt | tous les joueurs prêts avant lancement | `/ready`, `/launch`, `/stop` | `Campaign`, `CampaignMember` |
| SF11 | Notes privées | une note par joueur et campagne | `GET/PUT /campaigns/:id/notes` | `PlayerNote` |
| SF12 | Inventaire | équiper (un seul par type), utiliser un consommable | `/inventory*` | `InventoryEntry`, `Item` |
| SF13 | Échanges entre joueurs | offre → acceptation, transfert atomique | `/trades*`, `/inventory/player-give` | `TradeOffer` |
| SF14 | Temps réel | flux SSE par campagne | `GET /campaigns/:id/stream` | — |
| SF15 | Import / export campagne | export JSON, import contrôlé (voir Bloc 4) | `/campaigns/:id/export`, `/import` | agrégat |

## 5. Critères d'acceptation (extraits)

- **SF01** : un email déjà utilisé renvoie `409` ; un mot de passe < 8 renvoie `400`.
- **SF05** : rejoindre une campagne `CLOSED` renvoie `400` ; un code inconnu `404`.
- **SF09** : un joueur ne peut pas choisir son résultat (tirage serveur) ; un personnage à 0 PV ne peut pas agir.
- **SF13** : on ne peut pas échanger un objet qu'on ne possède pas ; l'acceptation concurrente ne duplique jamais un objet (transaction atomique).

## 6. Liste de contrôle des attendus fonctionnels

Voir `00-matrice-competences.md`. Chaque SF est **tracée** vers un endpoint et un modèle,
et **validée** par les contrôles techniques (`prisma:generate`, `tsc`, tests) documentés
dans `07-plan-de-tests.md`.
