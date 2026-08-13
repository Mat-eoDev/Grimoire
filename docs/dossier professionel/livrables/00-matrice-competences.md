# Matrice de couverture des 36 compétences — Projet Grimoire

> Ce document est la **liste de contrôle des attendus** (Bloc 1 / C1). Il relie chaque
> compétence du référentiel à la (ou les) preuve(s) produite(s) dans ce dossier et/ou
> dans le code. Les livrables sont **calés sur le code réellement déployé**
> (https://grimoire-q9hj.onrender.com), pas sur une conception antérieure.

## Rappel de l'application réelle

- **Pile technique** : Node + Express + Prisma + PostgreSQL (Neon) / React + Vite / SSE / cookies HttpOnly.
- **Modèles de données réels** : `User, Session, PasswordResetToken, Campaign, CampaignMember, CharacterSheet, PlayerNote, SceneElement, ActionRoll, ActionRollConsequence, CombatLogEntry, Item, InventoryEntry, TradeOffer, RevelationAsset` (15 modèles, 20 migrations).
- **Domaines fonctionnels réels** : authentification, campagnes (join par code), scène live (drag & drop, révélation), jets de dés à conséquences, inventaire, échanges entre joueurs, temps réel SSE.

## Tableau de couverture

| # | Compétence (résumé) | Preuve(s) | État |
|---|---|---|---|
| C1 | Spécifications fonctionnelles | `01-cahier-specifications-fonctionnelles.md`, ce fichier | ✅ |
| C2 | Architecture qualité en couches + PAQ | `02-architecture-logicielle.md`, `03-plan-assurance-qualite.md` | ✅ |
| C3 | Règles métier isolées / réutilisables | `05-services-metier-regles.md`, code `apps/server/src/lib/` | ✅ |
| C4 | Accès données découplé du stockage | `04-modele-donnees.md` §Persistance, `05-services-metier-regles.md` | ✅ |
| C5 | Tests unitaires + analyse statique | `07-plan-de-tests.md`, 24 tests `apps/server/src/**/*.test.ts`, `tsc`, CI `.github/workflows/ci.yml` | ✅ |
| C6 | Dimensionnement / performance | `08-performance-dimensionnement.md` | ✅ |
| C7 | IHM accessible (RGAA) | `09-accessibilite-rgaa.md` + améliorations front | ✅ |
| C8 | Analyse de risques / criticité | `06-analyse-risques-securite.md` | ✅ |
| C9 | Code lisible/maintenable + charte nommage | `03-plan-assurance-qualite.md` §Charte, `15-analyse-algorithmique.md` | ✅ |
| C10 | Intégrité BDD (contraintes, triggers) | `04-modele-donnees.md` §Intégrité, migration `..._integrity_triggers` | ✅ |
| C11 | Procédures utilisateurs / conformité | `10-procedures-et-workflow.md` | ✅ |
| C12 | Réingénierie de processus | `10-procedures-et-workflow.md` §Réingénierie | ✅ |
| C13 | Circulation documents / dictionnaire données | `10-procedures-et-workflow.md` §Circulation, `04-modele-donnees.md` §Dictionnaire | ✅ |
| C14 | MCD + règles de gestion | `04-modele-donnees.md` | ✅ |
| C15 | Urbanisation SI / couches | `02-architecture-logicielle.md` §Intégration SI | ✅ (validation chef de projet = humain) |
| C16 | Choix de réutilisation / ADR | `11-gestion-projet-agile.md` §ADR | ✅ |
| C17 | Planification / estimation | `11-gestion-projet-agile.md` §Planning | ✅ |
| C18 | Agile / backlog Scrum | `11-gestion-projet-agile.md` §Backlog | ✅ |
| C19 | Recette / PV de réception | `12-recette-et-integration.md` §Recette | ✅ (signature client = humain) |
| C20 | Présentation décideurs | `13-support-demonstration.md` | ✅ (soutenance orale = humain) |
| C21 | Intégrabilité correctif (ITIL) | `12-recette-et-integration.md` §Mise en exploitation | ✅ |
| C22 | Environnement collaboratif / CR réunions | `10-procedures-et-workflow.md` §Comptes-rendus | ✅ (réunions réelles = humain) |
| C23 | Communication FR / EN | `14-communication-EN.md`, `README.en.md` | ✅ |
| C24 | Lever les doutes techniques | `15-analyse-algorithmique.md` §Résolution | ✅ |
| C25 | Décomposition / algorithmes | `15-analyse-algorithmique.md` §Pseudo-code | ✅ |
| C26 | Traduire l'algo en code | `15-analyse-algorithmique.md`, code `routes/campaigns.ts` | ✅ |
| C27 | Faire évoluer l'existant sans casser | `15-analyse-algorithmique.md` §Avant/Après, PR #15-#20 | ✅ |
| C28 | Débogage / correction | `07-plan-de-tests.md` §Anomalies corrigées | ✅ |
| C29 | Intégration composants hétérogènes / RSE | `02-architecture-logicielle.md` §Intégrations, `16-interface-echange-donnees.md` §RSE | ✅ |
| C30 | Jeux d'essai + non-régression | `07-plan-de-tests.md`, tests automatisés | ✅ |
| C31 | Suivi disponibilité / CR activités | `11-gestion-projet-agile.md` §Suivi | ✅ |
| C32 | Rétro-documentation / analyse d'impact | `06-analyse-risques-securite.md`, `04-modele-donnees.md` | ✅ |
| C33 | Correspondance / mapping de données | `16-interface-echange-donnees.md` §Mapping, code export/import | ✅ |
| C34 | Agrégation / consolidation + RGPD | `16-interface-echange-donnees.md` §RGPD, `lib/characterStats.ts` | ✅ |
| C35 | Import / export / flux sync-async | `16-interface-echange-donnees.md`, routes `dataExchange`, SSE | ✅ |
| C36 | Scripts système / environnement | `17-environnement-et-scripts.md`, `docker-compose.yml`, `.devcontainer/` | ✅ |

## Compétences dont la validation finale dépend d'un acte humain

Les livrables (supports, critères, procédures) sont produits ; l'**acte de validation** reste à la charge de la personne :

- **C15** — signature du chef de projet sur le schéma d'architecture.
- **C19** — signature du client / formateur sur le procès-verbal de recette.
- **C20** — présentation orale devant le jury / comité.
- **C22** — tenue effective des réunions utilisateurs (les comptes-rendus type sont fournis).

Tout le reste est couvert par des artefacts produits dans ce dossier et le code.
