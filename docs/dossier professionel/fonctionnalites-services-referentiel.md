# NewMJ - Liste des fonctionnalites et services a realiser

Date: 2026-03-12

## 1) Perimetre

Ce document sert de base de reprise pour:

- lister les fonctionnalites metier a livrer;
- lister les services applicatifs/API a realiser;
- verifier la correspondance avec les attentes du referentiel (`ATTENDUE DU REFFERENTIEL.docx`).

Statuts utilises:

- `Fait` = present dans le code actuel et valide par les controles techniques (`prisma:generate`, `check`).
- `A finaliser` = existe mais incomplet pour l'usage cible.
- `A developper` = non implemente.

Definition de done technique minimale:

- `npm.cmd run prisma:generate` doit passer.
- `npm.cmd run check` doit passer.
- les tests serveur doivent passer (`npm.cmd --workspace @newmj/server test`).

## 2) Fonctionnalites metier a realiser

| ID | Fonctionnalite | Priorite | Statut | Notes |
|---|---|---|---|---|
| F01 | Inscription / connexion / deconnexion | MVP | Fait | Cookie HttpOnly + session serveur. |
| F02 | Creation de campagne | MVP | Fait | Campagne creee avec MJ actif. |
| F03 | Consultation de la campagne (vue MJ / joueur) | MVP | Fait | Payload unifie avec filtrage par role. |
| F04 | Invitation de joueurs par email + acceptation par token | MVP | Fait | Token + expiration. |
| F05 | Liste des participants et statuts | MVP | Fait | Visible via payload campagne. |
| F06 | Modification des parametres de campagne (titre, description, statut, fermeture) | MVP | A finaliser | `PATCH /campaigns/:campaignId` implemente; fermeture/suppression encore a cadrer. |
| F07 | Creation personnage joueur (race, metier/classe, stats de base) | MVP | Fait | Creation cote joueur + validation MJ. |
| F08 | Validation/rejet personnage joueur par MJ | MVP | Fait | Validation disponible (toggle approved). |
| F09 | Edition personnage (joueur/MJ selon droits) | MVP | A finaliser | `PATCH /characters/:characterId` implemente avec controles de droits. |
| F10 | Creation PNJ/monstres depuis modele ou manuel | MVP | Fait | Endpoint acteurs non-joueurs present. |
| F11 | Edition/suppression PNJ/monstres | MVP | A finaliser | `PATCH /actors/:actorId` + `DELETE /actors/:actorId` implementes (suppression logique). |
| F12 | Creation de scene narrative + decor visuel | MVP | Fait | Scene + visual initial. |
| F13 | Gestion fine de visibilite (MJ only, groupe, joueur cible) | MVP | A finaliser | publication ciblee par `memberIds` implementee; ciblage par groupe a ajouter. |
| F14 | Publication de scene vers la vue joueur | MVP | Fait | Publication + partage visuel actif. |
| F15 | Lancement combat (>=2 participants) | MVP | Fait | Verrouillage combat actif par campagne. |
| F16 | Journalisation actions de combat et maj HP/statut | MVP | Fait | Actions MJ + impact HP. |
| F17 | Participation active des joueurs au combat (saisie action joueur) | V2 | A developper | Actuellement pilotage majoritairement MJ. |
| F18 | Cloture combat avec validation MJ | MVP | Fait | Fin combat + event de synchro. |
| F19 | Creation et attribution de recompenses (perso ou groupe) | MVP | Fait | Reward + assignment implementes. |
| F20 | Modification d'une recompense existante | MVP | Fait | `PATCH /rewards/:rewardId` + `DELETE /reward-assignments/:assignmentId` implementes. |
| F21 | Tableau de bord MJ temps reel | MVP | Fait | SSE + dashboard cote web. |
| F22 | Journal/historique de campagne | V2 | A developper | Non implemente. |
| F23 | Bibliotheque avancee monstres/recompenses/inventaire | V2 | A developper | Non implemente. |


## 2.1) Structure maintenable (services)

- `apps/server/src/services/campaign-admin.service.ts` : campagnes, membres, acteurs, personnages.
- `apps/server/src/services/scene-admin.service.ts` : edition/suppression scenes.
- `apps/server/src/services/reward-admin.service.ts` : edition recompenses et correction d'attributions.

## 3) Services applicatifs/API a realiser
## Service S1 - Authentification et session

Etat: `Fait`

Endpoints existants:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

Complements a prevoir:

- rotation/invalidations de session multi-appareil;
- politique de mot de passe renforcee + reset mot de passe.

## Service S2 - Campagnes et membres

Etat: `A finaliser`

Endpoints existants:

- `POST /campaigns`
- `GET /campaigns/:campaignId`
- `PATCH /campaigns/:campaignId`
- `PATCH /campaigns/:campaignId/members/:memberId`
- `DELETE /campaigns/:campaignId` (mode soft/hard)
- `POST /campaigns/:campaignId/invites`
- `POST /invites/:token/accept`
- `GET /campaigns/:campaignId/events` (SSE)

Endpoints a ajouter:

- automatisation avancee des workflows membres (transfer ownership MJ, regles metier complementaires).
- politique de retention et purge definitive (si besoin metier).

## Service S3 - References (races/classes/modeles)

Etat: `Fait`

Endpoints existants:

- `GET /references`

Endpoints a ajouter:

- endpoints d'administration referentiels (si hors seed statique).

## Service S4 - Acteurs de jeu (PJ/PNJ/monstres)

Etat: `A finaliser`

Endpoints existants:

- `POST /campaigns/:campaignId/characters`
- `POST /characters/:characterId/validate`
- `PATCH /characters/:characterId`
- `POST /campaigns/:campaignId/actors`
- `PATCH /actors/:actorId`
- `DELETE /actors/:actorId`

Endpoints a ajouter:

- suppression physique optionnelle (actuellement suppression logique).
- edition avancee personnage (regles metier complementaires si besoin).

## Service S5 - Scenes et diffusion visuelle

Etat: `A finaliser`

Endpoints existants:

- `POST /campaigns/:campaignId/scenes`
- `POST /scenes/:sceneId/actors`
- `POST /scenes/:sceneId/publish` (ciblage possible via `memberIds`)
- `PATCH /scenes/:sceneId`
- `DELETE /scenes/:sceneId` (mode soft/hard)

Endpoints a ajouter:

- ciblage par groupe logique (actuellement ciblage explicite par `memberIds`).
- raffinement du workflow d'archivage (regles metier avancees).

## Service S6 - Combats

Etat: `A finaliser`

Endpoints existants:

- `POST /combats`
- `POST /combats/:combatId/actions`
- `POST /combats/:combatId/end`

Endpoints a ajouter:

- pause/reprise combat;
- gestion initiative avancee/ordre de tour;
- endpoint d'action cote joueur (si voulu dans le produit final).

## Service S7 - Recompenses

Etat: `A finaliser`

Endpoints existants:

- `POST /campaigns/:campaignId/rewards`
- `PATCH /rewards/:rewardId`
- `POST /rewards/:rewardId/assign`
- `DELETE /reward-assignments/:assignmentId`

Endpoints a ajouter:

- historisation complete des corrections d'attribution (audit detaille).

## 4) Verification par rapport aux attentes du referentiel

## 4.1 Synthese par bloc

| Bloc referentiel | Niveau de couverture actuel | Commentaire |
|---|---|---|
| Bloc 1 - Concevoir des applications numeriques en integrant la securite | Partiel avance | Le coeur fonctionnel est bien pose (auth, architecture en couches routes/lib/db, modelisation donnees). Il manque surtout les livrables de preuve (PAQ, tests qualite, accessibilite, analyse de risques, perf). |
| Bloc 2 - Piloter un projet DevOps | Partiel | Les elements techniques existent, mais les preuves de pilotage (backlog, planning, rituels Agile, recettes formelles, documents de validation) ne sont pas encore formalisees dans le dossier. |
| Bloc 3 - Developper des applications numeriques | Bon sur MVP | Deja bon sur implementation backend/frontend + correction/iteration, mais couverture tests unitaires et non-regression encore insuffisante. |
| Bloc 4 - Realiser une interface d'echange de donnees informatisees | Faible a partiel | Peu d'echange inter-logiciels formel (import/export/mapping), scripts d'environnement presents mais volet interfacage reste a realiser. |

## 4.2 Ecarts majeurs a combler pour etre alignes "attendus referentiel"

1. Formaliser les preuves documentaires (cahier des specs, liste de controle attendus fonctionnels, architecture logicielle, regles metier, schema persistance).
2. Renforcer les tests (plan de test, jeux d'essai, tests unitaires automatiques, traces de non-regression).
3. Produire les artefacts qualite/securite (analyse de risques, matrice criticite, plan de prevention, contraintes d'integrite SQL detaillees).
4. Ajouter les pieces projet (backlog, decisions d'architecture, planning, comptes-rendus, recette formelle).
5. Ajouter/planifier les capacites d'interfacage de donnees (import/export, mapping source/cible, documentation des flux).

## 4.3 Verdict

Verdict actuel: `Correspondance partielle`.

- Oui, la base fonctionnelle et les services coeur du MVP correspondent bien a l'esprit du referentiel.
- Non, ce n'est pas encore suffisant pour "cocher" pleinement les attentes du referentiel tant que les preuves methodologiques, qualite, tests, securite et pilotage ne sont pas completees.

## 5) Priorites de reprise recommandees

1. Maintenir le socle technique au vert (generation Prisma, checks TypeScript, tests serveur) avant chaque livraison fonctionnelle.
2. Finaliser les workflows restants autour des services (groupes de diffusion, retention/suppression hard, regles membres avancees).
3. Monter une base de tests automatises pour les flux critiques (auth, invitation, personnage, combat, recompense), y compris les routes PATCH ajoutees.
4. Produire les livrables de preuve referentiel en parallele du code (specs, architecture, qualite, risques, recette).

## 6) Etat technique verifie localement (2026-03-12)

- `npm.cmd run prisma:generate` : OK
- `npm.cmd run check` : OK
- `npm.cmd --workspace @newmj/server test` : OK

