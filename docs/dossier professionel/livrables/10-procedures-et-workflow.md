# Procédures, circulation documentaire & réingénierie — Grimoire

*Compétences visées : C11 (formaliser les procédures / conformité), C12 (réingénierie de processus), C13 (circulation des documents, acteurs, dictionnaire), C22 (environnement collaboratif, comptes-rendus).*

## 1. Procédures des services utilisateurs (C11)

### Procédure P1 — Ouverture d'une partie
1. Le MJ s'authentifie.
2. Le MJ crée une campagne → le système génère un **code de partie** unique.
3. Le MJ transmet le code (canal libre : oral, messagerie).
4. Chaque joueur s'authentifie et **rejoint** avec le code.
5. Chaque joueur crée son **personnage** (classe + stats de base).
6. Les joueurs se déclarent **prêts** ; le MJ **lance** la partie (contrôle : tous prêts).

### Procédure P2 — Déroulé d'une action à conséquence
1. Le MJ crée une **demande de jet** (seuils + conséquences par issue).
2. Le joueur ciblé **lance** le dé (tirage serveur).
3. Le MJ **résout** : la conséquence s'applique (dégâts/soin/suppression/narration), diffusée en temps réel.

### Procédure P3 — Réinitialisation de mot de passe
1. L'utilisateur demande un reset (email).
2. Le système envoie un lien à usage unique (1 h).
3. L'utilisateur définit un nouveau mot de passe → toutes ses sessions sont révoquées.

**Conformité gouvernance** : chaque procédure respecte les règles internes du projet
(authentification obligatoire, cloisonnement par campagne, moindre privilège MJ/joueur). La
synthèse de conformité figure dans `00-matrice-competences.md`.

## 2. Réingénierie de processus (C12) — avant / après

**Processus repensé : la conduite d'une partie de JDR.**

| Étape | AVANT (papier) | APRÈS (Grimoire) | Gain |
|---|---|---|---|
| Suivi des PV | Calcul mental / gomme | Mise à jour automatique, bornée | Fiabilité, rapidité |
| Visibilité des infos | Images cachées à la main | Révélation ciblée par le MJ | Contrôle narratif |
| Jets de dés | Dés physiques, contestables | Tirage serveur tracé | Intégrité |
| Inventaire / échanges | Fiches raturées | Transferts atomiques tracés | Zéro perte/duplication |
| Distanciel | Impossible | Temps réel SSE | Nouveau cas d'usage |

**Justification métier** : le MJ reste décideur (l'outil n'automatise pas l'arbitrage) mais est
déchargé de la tenue de comptes et gagne la maîtrise de la visibilité et du temps réel.

## 3. Circulation des documents / données (C13)

**Acteurs et rôles vis-à-vis des données**

| Donnée | Producteur | Consommateur | Stockage | Validation |
|---|---|---|---|---|
| Compte / session | Utilisateur | Système | `User`/`Session` | Auto (hash, expiration) |
| Campagne / membre | MJ | MJ + joueurs | `Campaign`/`CampaignMember` | MJ |
| Fiche personnage | Joueur | Joueur + MJ | `CharacterSheet` | MJ (impacts de combat) |
| Élément de scène | MJ | Joueurs (si visible) | `SceneElement` | MJ (visibilité) |
| Jet & conséquence | MJ + joueur | Tous | `ActionRoll` | MJ (résolution) |
| Échange | Joueur A | Joueur B | `TradeOffer` | Joueur B (acceptation) |

**Schéma de circulation (cas d'usage documentaire)**
```
Joueur ─(offre)─► TradeOffer(PENDING) ─(notification SSE)─► Joueur B
Joueur B ─(accepte)─► Transaction atomique ─► InventoryEntry transférée ─(SSE)─► tous
```
Le **dictionnaire de données** associé est maintenu dans `04-modele-donnees.md` (source de vérité :
`schema.prisma`).

## 4. Environnement collaboratif & comptes-rendus (C22)

**Traces d'échange réelles du projet** : le dépôt GitHub matérialise la collaboration
(branches de fonctionnalité, **Pull Requests numérotées** #1→#21, revues et merges). C'est le
canal de circulation des contributions.

**Modèle de compte-rendu de réunion** (à instancier pour chaque point réel — acte humain) :
```
CR de réunion — Projet Grimoire
Date / Participants / Rôle
1. Besoin reformulé : …
2. Décisions : …
3. Actions (qui / quoi / quand) : …
4. Points ouverts : …
Validation : ____________
```
> La **tenue effective** des réunions utilisateurs et la signature des CR relèvent d'un acte
> humain ; le présent modèle et le journal des demandes fonctionnelles (`01-cahier-…`) en
> constituent le support.
