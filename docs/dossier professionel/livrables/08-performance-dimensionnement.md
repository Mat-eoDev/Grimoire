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

## 6. Protocole de test de performance (à exécuter pour la preuve)

Test de charge léger reproductible (ex. `autocannon` ou `ab`) sur un endpoint représentatif :

```bash
# 50 connexions, 30 s, sur /health (lecture) et un login (écriture)
npx autocannon -c 50 -d 30 https://grimoire-q9hj.onrender.com/health
```

Relever : latence p50/p99, req/s, taux d'erreur. Objectif : p99 < 500 ms sur `/health`, 0 erreur.
Le rate limiting (10 login/15 min/IP) borne volontairement l'écriture — attendu.
