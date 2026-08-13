# Plan de tests & jeux d'essai — Grimoire

*Compétences visées : C5 (tests unitaires, cas limites, analyse statique), C30 (jeux d'essai, non-régression), C28 (correction d'anomalies).*

## 1. Stratégie de test

| Niveau | Outil | Portée |
|---|---|---|
| **Analyse statique** | `tsc --noEmit` (`npm run check`) | 100 % du code TS/TSX à chaque changement |
| **Tests unitaires** | `node:test` via `tsx` | Briques métier pures (`lib/`) |
| **Tests d'intégration automatisés** | script Node contre un serveur réel + PostgreSQL | Parcours MJ → joueur → résolution (§4 bis) |
| **Tests d'intégration manuels** | scénarios documentés (§4) | Flux critiques bout en bout |
| **Intégration continue** | GitHub Actions (`.github/workflows/ci.yml`) | Typage, tests, build et audit à chaque PR |
| **Vérification post-déploiement** | sonde comportementale | Rate limit `429` en prod |

Commande : `npm --workspace @newmj/server test` — **24 tests, tous verts**.

## 2. Tests unitaires automatisés (jeux de tests)

| Fichier | Cible | Cas nominaux | Cas limites |
|---|---|---|---|
| `lib/password.test.ts` | hachage/vérif | bon mot de passe accepté | mauvais rejeté, hash malformé |
| `lib/characterStats.test.ts` | `getBaseStats`, `getEffectiveStats`, `sumEquipmentBonuses` | chaque classe (1–4), bonus d'équipement cumulés | id inconnu → erreur gérée, aucun équipement → stats de base inchangées |
| `lib/http.test.ts` | validation d'entrée | chaîne valide, entier dans les bornes | vide, non-string, trop longue, nombre invalide, `NaN`, décimal, hors bornes |
| `lib/rollOutcome.test.ts` | classement d'un jet | échec / réussite selon les seuils | dé non lancé (`null`), valeurs exactement sur les seuils |
| `lib/rateLimit.test.ts` | limiteur | passe sous le seuil | bloque (429) au-delà, compteurs indépendants par IP |

Ces tests couvrent explicitement les **cas limites** exigés par C5/C30 (entrées vides, hors
bornes, valeurs par défaut, franchissement de seuil).

## 3. Anomalies détectées et corrigées (C28) — preuve de débogage

| Anomalie | Diagnostic | Correction | Preuve |
|---|---|---|---|
| Résultat de dé falsifiable | Le serveur faisait confiance à `body.result` | Tirage serveur exclusif | PR #20 |
| Duplication d'objets en échange | Lecture-vérif-écriture hors transaction | `$transaction` + décréments conditionnels | PR #17 |
| Énumération d'emails (timing) | Scrypt calculé seulement si l'email existe | Hash bidon à temps constant | PR #18 |
| 14 vulnérabilités de dépendances | `npm audit` | mise à jour semver-safe | PR #15 |
| Soin gratuit illimité | `POST /character` ré-appliquait les stats de base sans vérifier l'existence d'une fiche ni l'état de la campagne : n'importe quel joueur se resoignait à volonté, annulant la règle « personnage à terre » | Fiche verrouillée hors `DRAFT`, ré-envoi idempotent, état de sélection dérivé du serveur et non du `localStorage` | PR #29 |
| Résolution de jet non atomique | Jusqu'à quatre écritures hors transaction : une erreur au milieu laissait les dégâts appliqués avec un jet encore ouvert | `$transaction` + verrou logique sur le statut `ROLLED` | PR #30 |
| Bonus d'équipement inopérants | Les bonus n'étaient additionnés que dans le composant React ; le serveur plafonnait les soins au `maxHp` sans bonus | `getEffectiveStats` + persistance des stats effectives à chaque changement d'équipement | PR #33 |
| API exposée à `localhost:5173` en production | `CLIENT_ORIGIN` non déclaré dans `render.yaml` → CORS `credentials: true` sur une origine de développement | CORS retiré en production (même origine), variable déclarée | PR #31 |
| Journal de combat sans limite | Chaque attaque créait un élément de scène visible, jamais purgé | Table `CombatLogEntry` + lecture bornée | PR #35 |

## 4. Scénarios d'intégration (recette fonctionnelle)

Chaque scénario = préconditions → étapes → résultat attendu.

- **T-AUTH-01** Inscription : email neuf + pseudo neuf + mdp ≥ 8 → `201` + cookie de session.
- **T-AUTH-02** Inscription en doublon : email déjà pris → `409`.
- **T-AUTH-03** Login mauvais mot de passe → `401` (message générique).
- **T-AUTH-04** Reset : demande → email → nouveau mot de passe → anciennes sessions révoquées.
- **T-CAMP-01** Rejoindre avec un bon code → membre `PLAYER` ; code inconnu → `404` ; campagne close → `400`.
- **T-DICE-01** MJ crée une demande de jet ; joueur lance → résultat serveur ∈ [1, dieSides] ; MJ résout → PV mis à jour et bornés.
- **T-DICE-02** Envoi de `{result: 20}` par le client → **ignoré**, tirage serveur.
- **T-TRADE-01** Offre acceptée → objets transférés une seule fois ; deux acceptations concurrentes → pas de duplication (409 sur la seconde).
- **T-INV-01** Utiliser un consommable → PV bornés à `maxHp`, quantité décrémentée/supprimée.
- **T-RT-01** Un événement (déplacement, jet, don) est reçu en < 1 s par les autres membres (SSE).

## 4 bis. Test d'intégration automatisé

Un script Node exerce le parcours complet contre un serveur réellement démarré et une base
PostgreSQL 16 vierge : inscription MJ et joueur, création de campagne, adhésion par code,
choix de personnage, mise en jeu, don et équipement d'un objet, création d'un jet à quatre
paliers, lancer, résolution, puis tentatives d'abus.

Résultat de la dernière exécution (base vierge, 20 migrations appliquées) :

```
PASS  fiche creee avec les stats du Chevalier (hp=120)
PASS  reposter le meme personnage est idempotent
PASS  charId invalide refuse en 400
PASS  equiper augmente maxHp cote serveur (120 -> 140)
PASS  equiper augmente la defense cote serveur (20 -> 25)
PASS  les 4 paliers sont relus depuis la table fille
PASS  le de est tire cote serveur, dans les bornes
PASS  double resolution refusee
PASS  changement de personnage refuse en 409
PASS  qty non numerique refusee en 400
PASS  Content-Security-Policy / X-Content-Type-Options / X-Frame-Options presents
PASS  l'attaque alimente le journal et ne cree plus d'element de scene
```

La reprise de données de la migration `action_roll_consequences_table` a été vérifiée sur
un jeu d'essai contenant un jet au format courant, un jet au format hérité et un jet sans
effet : les trois cas sont restitués correctement.

## 5. Non-régression

- Le socle technique (`prisma:generate`, `check`, tests, build, `npm audit`) est **vérifié
  automatiquement à chaque pull request** par le workflow `ci.yml` — auparavant, rien ne
  tournait avant un merge et seule une erreur de compilation était rattrapée par Render.
- La simulation de merge des 6 correctifs a été **rejouée** avant déploiement (intégration sans
  conflit + build complet vert) — preuve de non-régression sur l'intégration.

## 6. Résultats attendus

```
$ npm run check          # tsc serveur + web : 0 erreur
$ npm --workspace @newmj/server test
# tests 24 / pass 24 / fail 0
$ npm audit --omit=dev --audit-level=high
# found 0 vulnerabilities
```
