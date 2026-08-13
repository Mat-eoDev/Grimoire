# Grimoire / NewMJ - Index des schemas

Date : 2026-07-01

Ce dossier contient les schemas techniques et fonctionnels a fournir dans le dossier CDAN.

## Schemas disponibles

| Fichier | Role dans le dossier |
|---|---|
| `use-cases.md` | Diagramme de cas d'utilisation MJ / joueur |
| `architecture-applicative.md` | Architecture en couches de l'application |
| `mcd-mld-mpc.md` | Modele de donnees conceptuel, logique et physique |
| `deploiement-local.md` | Execution locale avec Node, Vite, Express et PostgreSQL |
| `sequence-authentification.md` | Parcours inscription, connexion, session |
| `sequence-campagne.md` | Creation et entree dans une campagne |
| `sequence-scene-sse.md` | Synchronisation temps reel par SSE |
| `sequence-jet-action.md` | Cycle d'un jet d'action |
| `sequence-echange-objets.md` | Don et echange d'objets |
| `activite-lancement-campagne.md` | Workflow de lancement d'une campagne |
| `etat-campagne.md` | Cycle de vie d'une campagne |
| `etat-offre-echange.md` | Cycle de vie d'une offre d'echange |
| `cartographie-api.md` | Routes API principales par domaine |
| `securite.md` | Vue securite : auth, droits, filtrage |
| `evolutions-v2.md` | Evolutions prevues du modele et du produit |

## Utilisation conseillee

Pour le support de presentation, utiliser en priorite :

1. `use-cases.md`
2. `architecture-applicative.md`
3. `mcd-mld-mpc.md`
4. `sequence-authentification.md`
5. `sequence-scene-sse.md`
6. `sequence-jet-action.md`
7. `deploiement-local.md`


## Note de reorganisation

Les documents `mcd-mld-mpc-detaille.md` et `schemas-a-produire.md` proviennent de
l'ancien dossier `docs/uml/`, supprime de `main`. Leur contenu reste la reference
detaillee (MCD / MLD / MPC alignes sur `schema.prisma`) ; `mcd-mld-mpc.md` en est
la synthese accompagnant le diagramme drawio.
