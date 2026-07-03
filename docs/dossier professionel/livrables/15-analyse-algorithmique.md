# Analyse algorithmique & résolution technique — Grimoire

*Compétences visées : C24 (lever les doutes techniques), C25 (décomposer un problème), C26 (traduire en code), C27 (faire évoluer sans casser), C28 (déboguer).*

## 1. Cas d'étude : la résolution d'un jet de dé à conséquences

### Décomposition du problème (C25)
Une action de joueur doit :
1. être **demandée** par le MJ avec des seuils et une conséquence par issue ;
2. être **lancée** (le dé donne un nombre) ;
3. être **résolue** : classer le résultat en une issue, puis appliquer l'effet correspondant, en
   respectant les invariants (PV ∈ [0, maxHp], une seule demande active, personnage à terre inactif).

### Algorithme (pseudo-code)
```
fonction resoudreJet(jet):
    si jet.status != ROLLED: erreur 400
    issue ← classer(jet.result, jet.totalFailureMax, jet.successMin, jet.totalSuccessMin)
        # result <= totalFailureMax        → ECHEC_TOTAL
        # result >= totalSuccessMin         → REUSSITE_TOTALE
        # result >= successMin              → REUSSITE
        # sinon                             → ECHEC
    conséquence ← jet.conséquences[issue]
    selon conséquence.type:
        NARRATION       → créer élément de narration
        DAMAGE_TARGET   → cibleHp ← max(0, cibleHp - montant)
        DAMAGE_PLAYER   → joueurHp ← max(0, joueurHp - montant)   ; si 0 → annoncer "à terre"
        HEAL_PLAYER     → joueurHp ← min(maxHp, joueurHp + montant)
        DELETE_TARGET   → supprimer l'élément ciblé
    jet.status ← RESOLVED
    diffuser(SSE)
```

### Traduction en code (C26)
Implémenté dans `apps/server/src/routes/campaigns.ts` (`getRollOutcome`, handler
`/action-rolls/:rollId/resolve`). Le classement d'issue est une fonction pure `getRollOutcome`,
testable indépendamment.

## 2. Faire évoluer l'existant sans casser (C27) — avant / après

**Problème détecté** : le joueur pouvait imposer son résultat de dé.

**Avant** (`/action-rolls/:rollId/roll`) :
```ts
const requestedResult = toInteger(body.result, 0);
const result = requestedResult >= 1 && requestedResult <= existing.dieSides
  ? requestedResult                                   // ← valeur client acceptée
  : Math.floor(Math.random() * existing.dieSides) + 1;
```

**Après** :
```ts
// Tirage serveur uniquement : le client ne peut plus imposer sa valeur.
const result = Math.floor(Math.random() * existing.dieSides) + 1;
```

**Comprendre l'auteur avant de modifier** : l'ancien code envoyait la valeur de l'**animation 3D**
pour l'afficher de façon cohérente. La correction a donc aussi ajusté le front (animation rendue
**décorative**, le résultat serveur faisant foi) — évolution **sans régression** de l'expérience.

## 3. Lever les doutes techniques (C24)

| Doute | Démarche | Résolution |
|---|---|---|
| La lib `@3d-dice/dice-box` peut-elle forcer un résultat ? | Lecture des types, du code d'appel | Signature `roll(notation: string)` → non fiable ; on rend l'animation décorative |
| Deux acceptations d'échange peuvent-elles dupliquer un objet ? | Analyse du chemin lecture-vérif-écriture | Oui (TOCTOU) → transaction + décrément conditionnel |
| Le rate limit fonctionne-t-il derrière le proxy Render ? | `app.set("trust proxy", 1)` + test prod | `request.ip` correct, `429` observé |

## 4. Débogage (C28)

Boucle de correction appliquée : reproduire → interpréter (`tsc`, comportement) → corriger →
**vérifier** (`check`, tests, build, sonde prod). Exemple complet documenté : les 6 correctifs de
sécurité (`07-plan-de-tests.md` §3), chacun validé avant intégration.
