# Performance & dimensionnement — Grimoire

*Compétence visée : C6 (estimer la charge et la puissance nécessaire, anticiper la montée en charge).*

## 1. Profil d'usage

Application d'assistance au MJ pour des parties de jeu de rôle. Le profil est **intrinsèquement
petit et concurrentiel-faible** :

- Une partie = **1 MJ + ~3 à 6 joueurs** → ~4 à 7 connexions simultanées par campagne.
- Les actions sont **cadencées par le jeu** (un jet de dé toutes les quelques minutes), pas par des
  clics massifs.
- Le trafic dominant est le **flux SSE** (connexions longues, faible débit) et de petites requêtes JSON.

## 2. Estimation de charge

| Grandeur | Hypothèse | Estimation |
|---|---|---|
| Campagnes actives simultanées | cible réaliste | 5 à 20 |
| Utilisateurs concurrents | 20 campagnes × 6 | ~120 |
| Connexions SSE ouvertes | 1 par utilisateur actif | ~120 |
| Requêtes API / s (pic) | actions humaines espacées | < 10 req/s |
| Taille des payloads | JSON borné à 100 ko | faible |

## 3. Dimensionnement retenu

- **Architecture 2-tiers** : 1 service applicatif (Express + build React) + 1 base managée (Neon).
  Justifié par la faible concurrence : inutile de séparer front/back ou d'ajouter un tier cache.
- **Hébergement** : Render plan *free* (mono-instance) + Neon *free*. Suffisant pour la cible ;
  la latence perçue est dominée par le réveil d'instance (veille), atténué par un **ping cron
  toutes les 5 min** sur `/health`.
- **État HTTP sans session serveur en mémoire** (session en base) → **scalable horizontalement**
  sans adhérence à une instance, si la charge l'exigeait.

## 4. Points de vigilance identifiés

- **SSE = connexions longues** : chaque instance garde N sockets ouvertes (`sseHub`). Sur mono-
  instance, borne pratique de quelques centaines de connexions. Au-delà, passer à un plan payant
  multi-instances **nécessiterait un bus d'événements partagé** (Redis pub/sub) car `sseHub` est
  en mémoire locale — **limite documentée** et anticipée.
- **Plan free** : CPU/RAM limités et mise en veille. Acceptable pour une démo/soutenance, à
  upgrader pour un usage réel soutenu.

## 5. Scénarios de montée en charge (anticipation)

| Palier | Charge | Adaptation |
|---|---|---|
| P0 (actuel) | ≤ 120 users | Mono-instance free — OK |
| P1 | quelques centaines | Instance payante (plus de RAM pour les sockets SSE) |
| P2 | milliers | Multi-instances + **Redis pub/sub** pour le SSE + pool Postgres dédié |
| P3 | forte croissance | Séparer le service statique (CDN), réplique lecture Postgres |

## 6. Test de charge — résultats mesurés

Test **réellement exécuté** avec `autocannon` (20 connexions concurrentes, 15 s) sur `/health`
en production (Render *free*), le 2026-07-03 :

```bash
npx autocannon -c 20 -d 15 https://grimoire-q9hj.onrender.com/health
```

| Métrique | Mesure |
|---|---|
| Requêtes servies | 596 en 15,04 s (~40 req/s) |
| Latence médiane (p50) | **55 ms** |
| Latence p97.5 | 2 318 ms |
| Latence p99 | 3 169 ms |
| Latence max | 3 177 ms |
| Erreurs | 20 timeouts |

**Interprétation (honnête).** En usage nominal, la latence est excellente (p50 = 55 ms). Mais sous
**20 connexions simultanées**, l'instance *free* mono-cœur sature : la queue s'allonge (p99 ≈ 3,2 s)
et quelques requêtes tombent en timeout. C'est la **confirmation empirique du plafond du plan
gratuit** décrit au §4 : pour un usage réel soutenu (> quelques dizaines de connexions), le passage
au palier P1/P2 (instance dédiée, puis multi-instances + Redis pub/sub pour le SSE) est nécessaire.
Pour la cible réelle (~4 à 7 joueurs par partie, actions espacées), la marge est confortable.


## Optimisations mesurées (2026-08-13)

**Trafic temps réel.** Le temps réel reposait sur trois mécanismes simultanés : SSE, sondage
de la campagne toutes les 4 s et sondage des jets toutes les 2 s. Chaque joueur ouvrait en
outre deux `EventSource` (scène et panneau d'échanges).

| | Avant | Après |
|---|---|---|
| Connexions SSE (table de 5 joueurs + MJ) | ~12 | 6 (une par client) |
| Requêtes de sondage par client en partie | ~0,75 /s | ~0,08 /s |
| Coupure de connexion inactive par un proxy | non traitée | heartbeat serveur toutes les 25 s |

Le sondage de la campagne reste à 4 s dans le lobby, où aucun événement n'arrive par SSE
(arrivées de joueurs, statuts « prêt »), et passe à 20 s une fois la partie lancée.

**Poids des médias.** 59 images étaient servies en PNG non redimensionnés — dont des portraits
de 3,6 Mo en 1024×1536 et une icône d'inventaire de 3 Mo à la même résolution.

| | Avant | Après |
|---|---|---|
| Poids total des médias | 92,5 Mo | 4,1 Mo (**−95,6 %**) |
| Portrait de personnage | 3,6 Mo | ~90 Ko |
| Icône d'inventaire | 3,0 Mo | ~25 Ko |

Format WebP, dimensions plafonnées selon l'usage : 1920 px pour les décors, 1024 px pour les
portraits, 768 px pour les PNJ, 512 px pour les icônes d'inventaire.
