# Grimoire / NewMJ - Schemas a produire pour le dossier CDAN

Date : 2026-07-01

## Objectif

Ce document liste les schemas utiles pour presenter le projet Grimoire / NewMJ dans le dossier professionnel et dans le support de presentation CDAN.

Les schemas sont classes par priorite :

- `Indispensable` : fortement recommande pour prouver les competences du referentiel.
- `Recommande` : utile pour clarifier les choix techniques.
- `Optionnel` : interessant si le dossier doit etre plus complet.

## Schemas indispensables

| Schema | Objectif | Competences demontrees | Fichier conseille | Realisable proprement |
|---|---|---|---|---|
| Diagramme de cas d'utilisation | Montrer les interactions entre MJ, joueur et application | Analyse du besoin, maquettes fonctionnelles, roles | `docs/uml/use-cases.md` | Oui |
| MCD / MLD / MPC | Montrer la conception des donnees | Base relationnelle, modelisation, contraintes | `docs/uml/mcd-mpc.md` | Deja fait |
| Architecture applicative | Montrer l'organisation React / API / Prisma / PostgreSQL | Architecture en couches, environnement technique | `docs/uml/architecture-applicative.md` | Oui |
| Diagramme de deploiement local | Montrer comment l'application s'execute | Preparation de deploiement, environnement, Docker | `docs/uml/deploiement-local.md` | Oui |
| Parcours d'authentification | Montrer la securisation de la connexion | Securite, session, cookie HttpOnly | `docs/uml/sequence-authentification.md` | Oui |
| Parcours campagne MJ / joueur | Montrer la creation et l'entree dans une campagne | Composants metier, roles, acces donnees | `docs/uml/sequence-campagne.md` | Oui |

## Schemas recommandes

| Schema | Objectif | Competences demontrees | Fichier conseille | Realisable proprement |
|---|---|---|---|---|
| Diagramme de sequence - scene temps reel | Expliquer la mise a jour de scene et SSE | Echanges client/serveur, temps reel | `docs/uml/sequence-scene-sse.md` | Oui |
| Diagramme de sequence - jet d'action | Expliquer le cycle MJ -> joueur -> resolution | Logique metier, validation, consequences | `docs/uml/sequence-jet-action.md` | Oui |
| Diagramme de sequence - inventaire et echange | Expliquer don, proposition, acceptation/refus | Regles metier, controle des droits | `docs/uml/sequence-echange-objets.md` | Oui |
| Diagramme d'activite - lancer une campagne | Montrer le workflow fonctionnel global | Gestion de projet, parcours utilisateur | `docs/uml/activite-lancement-campagne.md` | Oui |
| Diagramme d'etats - campagne | Montrer les statuts DRAFT, ACTIVE, CLOSED | Cycle de vie, regles metier | `docs/uml/etat-campagne.md` | Oui |
| Diagramme d'etats - offre d'echange | Montrer PENDING, ACCEPTED, REFUSED, CANCELLED | Workflow metier, transitions | `docs/uml/etat-offre-echange.md` | Oui |
| Cartographie API | Lister les routes principales par domaine | Architecture backend, services applicatifs | `docs/uml/cartographie-api.md` | Oui |

## Schemas optionnels

| Schema | Objectif | Competences demontrees | Fichier conseille | Realisable proprement |
|---|---|---|---|---|
| Diagramme de composants frontend | Montrer les pages et composants React | Interface utilisateur, organisation front | `docs/uml/composants-frontend.md` | Oui |
| Diagramme de packages backend | Montrer routes, middleware, lib, Prisma | Organisation du code, couches techniques | `docs/uml/packages-backend.md` | Oui |
| Parcours utilisateur joueur | Montrer connexion, rejoindre, personnage, inventaire | UX, parcours fonctionnel | `docs/uml/parcours-joueur.md` | Oui |
| Parcours utilisateur MJ | Montrer creation campagne, scene, jets, objets | UX, parcours fonctionnel | `docs/uml/parcours-mj.md` | Oui |
| Diagramme de securite | Montrer auth, roles, filtrage, sessions | Securite applicative | `docs/uml/securite.md` | Oui |
| Diagramme d'evolution V2 | Montrer scenes, combats, recompenses dediees | Recul technique, architecture evolutive | `docs/uml/evolutions-v2.md` | Oui |

## Priorite de realisation conseillee

Pour le dossier CDAN, l'ordre le plus efficace est :

1. `use-cases.md`
2. `architecture-applicative.md`
3. `mcd-mpc.md`
4. `deploiement-local.md`
5. `sequence-authentification.md`
6. `sequence-campagne.md`
7. `sequence-scene-sse.md`
8. `sequence-jet-action.md`
9. `cartographie-api.md`

Cet ensemble suffit a prouver les points principaux du referentiel :

- analyse du besoin
- conception d'une application en couches
- conception de la base de donnees
- developpement d'interfaces et de composants metier
- securisation de l'application
- acces aux donnees
- preparation du deploiement
- documentation technique

## Schemas a eviter ou a presenter comme V2

Certains schemas seraient interessants mais ne doivent pas etre presentes comme deja implementes :

- diagramme complet de combat avec rounds et participants
- modele complet de recompenses dediees
- gestion avancee des invitations par email et token
- systeme de races/classes administrable en base
- historique complet des scenes

Ces elements peuvent etre places dans une partie `evolutions prevues`, car le schema Prisma actuel ne contient pas encore de tables dediees pour ces sujets.

## Format recommande

Pour garder un dossier propre :

- utiliser un fichier Markdown par schema
- stocker tous les schemas dans `docs/uml`
- utiliser Mermaid pour les diagrammes modifiables
- eviter les images non modifiables sauf pour une exportation finale en PDF
- ajouter au debut de chaque fichier :
  - objectif du schema
  - competences demontrees
  - source technique utilisee

## Ce que je peux produire directement

Je peux generer proprement dans `docs/uml` :

- les diagrammes Mermaid
- les explications courtes pour le dossier
- une version orientee jury pour chaque schema
- une cartographie des routes API depuis le code Express
- une matrice `schema -> competence RNCP`
- une version exportable en images si tu veux ensuite l'integrer dans un diaporama

