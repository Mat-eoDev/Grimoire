# Diagramme de cas d'utilisation

## Objectif

Montrer les interactions principales entre les deux profils utilisateurs : le Maitre du Jeu et le joueur.

## Competences demontrees

- Analyse des besoins utilisateur
- Identification des acteurs
- Definition du perimetre fonctionnel du MVP
- Prise en compte des droits selon le role

```mermaid
flowchart LR
    GM["Maitre du Jeu"]
    PLAYER["Joueur"]
    APP["Application Grimoire / NewMJ"]

    UC_AUTH["S'inscrire / se connecter"]
    UC_CREATE_CAMPAIGN["Creer une campagne"]
    UC_JOIN_CAMPAIGN["Rejoindre une campagne"]
    UC_READY["Se declarer pret"]
    UC_LAUNCH["Lancer / arreter la campagne"]
    UC_CHARACTER["Creer une fiche personnage"]
    UC_SCENE["Piloter la scene"]
    UC_VISIBILITY["Afficher / masquer des elements"]
    UC_ROLL["Demander et resoudre un jet d'action"]
    UC_INVENTORY_GM["Attribuer des objets"]
    UC_INVENTORY_PLAYER["Consulter et utiliser l'inventaire"]
    UC_TRADE["Donner ou echanger des objets"]
    UC_NOTES["Rediger des notes privees"]

    GM --> UC_AUTH
    PLAYER --> UC_AUTH

    GM --> UC_CREATE_CAMPAIGN
    GM --> UC_LAUNCH
    GM --> UC_SCENE
    GM --> UC_VISIBILITY
    GM --> UC_ROLL
    GM --> UC_INVENTORY_GM

    PLAYER --> UC_JOIN_CAMPAIGN
    PLAYER --> UC_READY
    PLAYER --> UC_CHARACTER
    PLAYER --> UC_INVENTORY_PLAYER
    PLAYER --> UC_TRADE
    PLAYER --> UC_NOTES
    PLAYER --> UC_ROLL

    UC_AUTH --> APP
    UC_CREATE_CAMPAIGN --> APP
    UC_JOIN_CAMPAIGN --> APP
    UC_READY --> APP
    UC_LAUNCH --> APP
    UC_CHARACTER --> APP
    UC_SCENE --> APP
    UC_VISIBILITY --> APP
    UC_ROLL --> APP
    UC_INVENTORY_GM --> APP
    UC_INVENTORY_PLAYER --> APP
    UC_TRADE --> APP
    UC_NOTES --> APP
```

## Points a presenter au jury

- Le MJ garde le controle de la campagne et de la visibilite.
- Le joueur interagit uniquement avec les fonctionnalites autorisees.
- Les droits sont verifies cote serveur, pas uniquement dans l'interface.

