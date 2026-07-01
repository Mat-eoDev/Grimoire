# Cartographie API

## Objectif

Lister les routes principales exposees par le backend Express.

## Competences demontrees

- Documentation technique
- Architecture backend
- Organisation des services applicatifs
- Acces securise aux donnees

## Authentification

| Methode | Route | Role |
|---|---|---|
| POST | `/auth/register` | Creer un compte |
| POST | `/auth/login` | Connecter un utilisateur |
| POST | `/auth/logout` | Detruire la session courante |
| GET | `/auth/me` | Recuperer la session et les campagnes |

## Campagnes

| Methode | Route | Role |
|---|---|---|
| POST | `/campaigns` | Creer une campagne |
| POST | `/campaigns/join` | Rejoindre avec un code |
| GET | `/campaigns/:campaignId` | Charger la campagne selon le role |
| POST | `/campaigns/:campaignId/ready` | Marquer un joueur pret |
| POST | `/campaigns/:campaignId/launch` | Lancer la campagne |
| POST | `/campaigns/:campaignId/stop` | Arreter la campagne |

## Scene et temps reel

| Methode | Route | Role |
|---|---|---|
| GET | `/campaigns/:campaignId/stream` | Ouvrir le flux SSE |
| PUT | `/campaigns/:campaignId/live-scene` | Modifier la scene courante |
| POST | `/campaigns/:campaignId/scene-elements` | Ajouter un element |
| PATCH | `/campaigns/:campaignId/scene-elements/:elementId` | Modifier la visibilite |
| PATCH | `/campaigns/:campaignId/scene-elements/:elementId/position` | Deplacer un element |
| DELETE | `/campaigns/:campaignId/scene-elements/:elementId` | Supprimer un element |

## Jets d'action

| Methode | Route | Role |
|---|---|---|
| GET | `/campaigns/:campaignId/action-rolls/active` | Recuperer les jets actifs |
| POST | `/campaigns/:campaignId/action-rolls` | MJ cree un jet |
| POST | `/campaigns/:campaignId/action-rolls/:rollId/roll` | Joueur lance le de |
| POST | `/campaigns/:campaignId/action-rolls/:rollId/reroll` | MJ relance la demande |
| POST | `/campaigns/:campaignId/action-rolls/:rollId/cancel` | MJ annule le jet |
| POST | `/campaigns/:campaignId/action-rolls/:rollId/resolve` | MJ resout le jet |

## Notes et personnages

| Methode | Route | Role |
|---|---|---|
| GET | `/campaigns/:campaignId/notes` | Charger les notes privees |
| PUT | `/campaigns/:campaignId/notes` | Sauvegarder les notes privees |
| POST | `/campaigns/:campaignId/character` | Creer ou modifier sa fiche |
| GET | `/campaigns/:campaignId/character` | Charger sa fiche |

## Inventaire

| Methode | Route | Role |
|---|---|---|
| GET | `/campaigns/:campaignId/items` | Lister les objets |
| GET | `/campaigns/:campaignId/inventory` | Inventaire du joueur |
| GET | `/campaigns/:campaignId/inventory/all` | Inventaires de tous les joueurs pour le MJ |
| POST | `/campaigns/:campaignId/inventory/give` | MJ donne un objet |
| PATCH | `/campaigns/:campaignId/inventory/:entryId/equip` | Equiper ou desequiper |
| DELETE | `/campaigns/:campaignId/inventory/:entryId` | Retirer un objet |
| POST | `/campaigns/:campaignId/inventory/:entryId/use` | Utiliser un consommable |
| GET | `/campaigns/:campaignId/players/:userId/inventory` | Voir l'inventaire d'un joueur |
| GET | `/campaigns/:campaignId/players/:userId/character` | MJ consulte une fiche joueur |

## Echanges

| Methode | Route | Role |
|---|---|---|
| POST | `/campaigns/:campaignId/inventory/player-give` | Don direct entre joueurs |
| GET | `/campaigns/:campaignId/trades/pending` | Offres en attente |
| POST | `/campaigns/:campaignId/trades` | Proposer un echange |
| POST | `/campaigns/:campaignId/trades/:tradeId/accept` | Accepter une offre |
| POST | `/campaigns/:campaignId/trades/:tradeId/refuse` | Refuser une offre |
| POST | `/campaigns/:campaignId/trades/:tradeId/cancel` | Annuler une offre |

