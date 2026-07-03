# Support de démonstration & argumentaire — Grimoire

*Compétence visée : C20 (adapter son discours à l'auditoire, obtenir l'adhésion des décideurs).*

> Ce document est le **support** de la soutenance. La **présentation orale** elle-même est un
> acte humain.

## 1. Pitch (30 s, pour un décideur non technique)

> « Grimoire est un outil web qui assiste le Maître du Jeu pendant une partie de jeu de rôle :
> il gère en temps réel la scène, les personnages, les jets de dés et l'inventaire, pour que le
> MJ se concentre sur l'histoire. Le tout est en ligne, sécurisé et accessible depuis un simple
> navigateur. »

## 2. Plan de démonstration (10 min)

| # | Séquence | À montrer | Message |
|---|---|---|---|
| 1 | Connexion | Inscription/login | Sécurité (cookie HttpOnly) |
| 2 | Créer une campagne | Code de partie | Simplicité d'onboarding |
| 3 | Rejoindre (2e onglet joueur) | Temps réel | SSE, synchronisation |
| 4 | Composer la scène | Ennemi + révélation ciblée | Contrôle du MJ |
| 5 | Demander un jet | Seuils + conséquences | Cœur métier |
| 6 | Lancer le dé (joueur) | Résultat + impact PV | Intégrité (tirage serveur) |
| 7 | Échange d'objet | Offre/acceptation | Robustesse (transaction) |
| 8 | Export de campagne | Fichier JSON | Interopérabilité (Bloc 4) |

## 3. Argumentaire par type d'auditoire (adaptation du discours)

| Auditoire | Angle | Vocabulaire |
|---|---|---|
| **Décideur / client** | Valeur d'usage, gain de temps, accessible partout | « expérience », « fiabilité », « en ligne » |
| **Jury technique** | Architecture en couches, sécurité, temps réel, tests | « SSE », « transaction atomique », « rate limiting » |
| **Utilisateur final (MJ)** | Contrôle narratif, rapidité en séance | « scène », « révélation », « jet » |

## 4. Lien démonstration ↔ besoins exprimés

Chaque séquence de la démo répond à un besoin du `01-cahier-specifications-fonctionnelles.md` :
onboarding par code (SF04/05), scène et visibilité (SF08), jets à conséquences (SF09), échanges
(SF13), temps réel (SF14), interopérabilité (SF15). La traçabilité besoin → démo → preuve est
assurée par `00-matrice-competences.md`.

## 5. Éléments de réassurance (pour l'adhésion)

- **En production** et vérifié : https://grimoire-q9hj.onrender.com
- **Sécurité auditée** : 12 risques identifiés, cotés, traités (`06-analyse-risques-securite.md`).
- **Qualité** : analyse statique + tests au vert, intégration continue via PR.
