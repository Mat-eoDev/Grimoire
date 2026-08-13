# Evolutions V2

## Objectif

Presenter les evolutions possibles sans les confondre avec le MVP implemente.

## Competences demontrees

- Recul technique
- Capacite a identifier les limites d'un MVP
- Projection d'une architecture evolutive

```mermaid
flowchart LR
    MVP["MVP actuel"]

    SCENE["Table Scene<br/>historique narratif"]
    COMBAT["Module Combat<br/>rounds, participants, initiative"]
    REWARD["Module Recompense<br/>XP, or, objets, histoire"]
    INVITE["Invitation email<br/>token + expiration"]
    REF["Referentiels<br/>races et classes en base"]
    CI["CI/CD<br/>tests et deploiement automatise"]
    ACCESS["Accessibilite RGAA"]
    RGPD["RGPD<br/>mentions, retention, suppression"]

    MVP --> SCENE
    MVP --> COMBAT
    MVP --> REWARD
    MVP --> INVITE
    MVP --> REF
    MVP --> CI
    MVP --> ACCESS
    MVP --> RGPD
```

## A presenter comme limites maitrisees

- La scene courante est stockee directement sur la campagne ; une V2 pourrait historiser les scenes.
- Les combats sont aujourd'hui representes par les jets d'action ; une V2 pourrait ajouter un module combat complet.
- Les recompenses sont gerees par les objets et l'inventaire ; une V2 pourrait ajouter une table dediee.
- Les invitations sont gerees par code de campagne ; une V2 pourrait ajouter des invitations par email.

