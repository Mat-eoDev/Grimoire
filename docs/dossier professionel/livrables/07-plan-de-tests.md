# Plan de tests & jeux d'essai — Grimoire

*Compétences visées : C5 (tests unitaires, cas limites, analyse statique), C30 (jeux d'essai, non-régression), C28 (correction d'anomalies).*

## 1. Stratégie de test

| Niveau | Outil | Portée |
|---|---|---|
| **Analyse statique** | `tsc --noEmit` (`npm run check`) | 100 % du code TS/TSX à chaque changement |
| **Tests unitaires** | `node:test` via `tsx` | Briques métier pures (`lib/`) |
| **Tests d'intégration manuels** | scénarios documentés (§4) | Flux critiques bout en bout |
| **Vérification post-déploiement** | sonde comportementale | Rate limit `429` en prod |

Commande : `npm --workspace @newmj/server test`.

## 2. Tests unitaires automatisés (jeux de tests)

| Fichier | Cible | Cas nominaux | Cas limites |
|---|---|---|---|
| `lib/password.test.ts` | hachage/vérif | bon mot de passe accepté | mauvais rejeté, hash malformé |
| `lib/characterStats.test.ts` | `getBaseStats` | chaque classe (1–4) | id inconnu → erreur gérée |
| `lib/http.test.ts` | validation d'entrée | chaîne valide | vide, non-string, trop longue, nombre invalide |
| `lib/rateLimit.test.ts` | limiteur | passe sous le seuil | bloque (429) au-delà, reset après fenêtre |

Ces tests couvrent explicitement les **cas limites** exigés par C5/C30 (entrées vides, hors
bornes, valeurs par défaut, franchissement de seuil).

## 3. Anomalies détectées et corrigées (C28) — preuve de débogage

| Anomalie | Diagnostic | Correction | Preuve |
|---|---|---|---|
| Résultat de dé falsifiable | Le serveur faisait confiance à `body.result` | Tirage serveur exclusif | PR #20 |
| Duplication d'objets en échange | Lecture-vérif-écriture hors transaction | `$transaction` + décréments conditionnels | PR #17 |
| Énumération d'emails (timing) | Scrypt calculé seulement si l'email existe | Hash bidon à temps constant | PR #18 |
| 14 vulnérabilités de dépendances | `npm audit` | mise à jour semver-safe | PR #15 |

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

## 5. Non-régression

- Le socle technique (`prisma:generate`, `check`, tests) doit être **vert avant chaque merge**
  (barrière PR + build Render).
- La simulation de merge des 6 correctifs a été **rejouée** avant déploiement (intégration sans
  conflit + build complet vert) — preuve de non-régression sur l'intégration.

## 6. Résultats attendus

```
$ npm run check          # tsc serveur + web : 0 erreur
$ npm --workspace @newmj/server test
# ok  password / characterStats / http / rateLimit  (tous verts)
```
