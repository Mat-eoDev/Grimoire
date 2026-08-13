# Accessibilité (RGAA) & normes de présentation — Grimoire

*Compétence visée : C7 (IHM accessible, norme RGAA, situations de handicap, maquettage).*

## 1. Cadre normatif

Référentiel visé : **RGAA 4.1** (déclinaison française des WCAG 2.1, niveau AA cible). Ce document
présente les choix de conception, l'état de conformité auto-évalué, et le plan de mise en conformité.

## 2. Choix de conception favorisant l'accessibilité

| Thème RGAA | Choix appliqué dans le code |
|---|---|
| **Langue** | `<html lang="fr">` défini (`apps/web/index.html`) |
| **Structure de page** | Balises sémantiques React (`<header>`, `<section>`, `<button>`, `<h1..h2>`) plutôt que des `<div>` cliquables |
| **Métadonnées** | `<title>`, `<meta name="description">`, `<meta viewport>`, `theme-color` |
| **Responsive / zoom** | Refonte *mobile-first* (branche `feature/refonte-mobile-first`), unités relatives, `max-width:100%` sur les images → supporte le zoom et le handicap moteur/visuel |
| **Images** | `alt` renseigné pour les images **informatives** (avatars, objets) ; `alt=""` pour les images **décoratives** (fonds, dés) — distinction RGAA correcte |
| **Formulaires** | Champs natifs (`<input>`, `<button type=…>`) exploitables au clavier et par lecteur d'écran |
| **Couleur** | Le thème *dark-fantasy* mise sur un contraste fort texte clair / fond sombre |

## 3. État de conformité auto-évalué

| Critère | État | Commentaire |
|---|---|---|
| Langue de page | ✅ | `lang="fr"` |
| Titres et structure | 🟡 | Hiérarchie de titres présente, à auditer page par page |
| Alternatives textuelles | 🟡 | Informatives OK ; passer en revue les icônes-boutons (`aria-label`) |
| Navigation clavier | 🟡 | Éléments natifs OK ; le plateau *drag & drop* (scène MJ) nécessite une alternative clavier |
| Contrastes | 🟡 | À mesurer au contrôleur de contraste (objectif AA 4.5:1) |
| Zoom / responsive | ✅ | Mobile-first, unités relatives |

## 3bis. Améliorations réellement appliquées (code)

| Correctif | Fichier | Critère RGAA |
|---|---|---|
| `lang="fr"` + `<meta description>` | `apps/web/index.html` | Langue, métadonnées |
| **`aria-live="polite"` + `role="status"`** sur les zones de résultat/statut des jets | `LiveCampaign.tsx` (3 zones) | Contenu dynamique annoncé aux lecteurs d'écran |
| **`aria-label`** sur le champ de recherche (placeholder ≠ label) | `LiveCampaign.tsx` | Étiquetage des champs |
| Champs titre/narration déjà encapsulés dans `<label>` | `LiveCampaign.tsx` | Étiquetage (vérifié conforme) |

Ces correctifs traitent le point le plus critique pour un joueur déficient visuel : **le résultat
d'un jet et son issue, mis à jour en asynchrone, sont désormais annoncés** par les technologies
d'assistance.

## 4. Plan de mise en conformité (prévention du handicap)

1. **Handicap visuel** : `aria-label` sur tous les boutons-icônes ; vérifier les contrastes au ratio
   AA ; conserver les alternatives textuelles.
2. **Handicap moteur** : garantir un parcours 100 % clavier ; fournir une **alternative non
   drag & drop** pour positionner un élément de scène (champs de position déjà présents côté données :
   `posX/posY` peuvent être saisis).
3. **Handicap cognitif** : libellés explicites (déjà appliqué : « Lancer le d20 », « En attente… »),
   messages d'erreur en langage clair.
4. **Lecteurs d'écran** : ajouter `aria-live="polite"` sur la zone de statut des jets (le résultat
   arrive en asynchrone) pour l'annoncer.

## 5. Maquettage

L'IHM livrée sert de **prototype haute-fidélité** de référence (thème *dark-fantasy*, responsive).
Les écrans clés (accueil/auth, campagne, scène live, fiche/inventaire) sont réalisés et
navigables en production — support de validation IHM. Un **bordereau de réception IHM** (checklist
écran par écran : titre, structure, alternatives, clavier, contraste) est à contresigner lors de
la recette (`12-recette-et-integration.md`).
