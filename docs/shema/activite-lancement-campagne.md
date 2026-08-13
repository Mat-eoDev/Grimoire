# Diagramme d'activite - lancement de campagne

## Objectif

Representer le workflow fonctionnel allant de la creation d'une campagne a son lancement.

## Competences demontrees

- Analyse fonctionnelle
- Formalisation d'un processus metier
- Validation des conditions de lancement

```mermaid
flowchart TD
    START([Debut])
    LOGIN_GM["Le MJ se connecte"]
    CREATE["Le MJ cree une campagne"]
    CODE["L'application genere un code de participation"]
    SHARE["Le MJ partage le code aux joueurs"]
    JOIN["Les joueurs rejoignent la campagne"]
    CHARACTER["Les joueurs creent leur fiche personnage"]
    READY["Les joueurs se declarent prets"]
    CHECK{"Tous les joueurs sont prets ?"}
    WAIT["Attente des joueurs"]
    LAUNCH["Le MJ lance la campagne"]
    ACTIVE["Campagne ACTIVE"]
    END([Fin])

    START --> LOGIN_GM
    LOGIN_GM --> CREATE
    CREATE --> CODE
    CODE --> SHARE
    SHARE --> JOIN
    JOIN --> CHARACTER
    CHARACTER --> READY
    READY --> CHECK
    CHECK -- Non --> WAIT
    WAIT --> READY
    CHECK -- Oui --> LAUNCH
    LAUNCH --> ACTIVE
    ACTIVE --> END
```

