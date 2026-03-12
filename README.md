# NewMJ MVP

MVP web pour l'assistance au Maitre du Jeu :

- backend `Node + Express + Prisma + PostgreSQL`
- frontend `React + Vite`
- auth par cookie `HttpOnly`
- diffusion joueur en `SSE`

## Lancement local

1. Copier `.env.example` vers `.env`
2. Demarrer PostgreSQL
   `docker compose up -d`
3. Installer les dependances
   `npm.cmd install`
4. Generer Prisma et lancer la migration
   `npm.cmd run prisma:generate`
   `npm.cmd run prisma:migrate`
5. Seeder les referentiels
   `npm.cmd run prisma:seed`
6. Lancer le backend et le frontend
   `npm.cmd run dev:server`
   `npm.cmd run dev:web`

## Comptes et demo

Le seed n'ajoute pas de compte de demo. Cree d'abord :

- un compte MJ
- un ou plusieurs comptes joueurs

Puis :

1. connecte-toi en MJ
2. cree une campagne
3. cree une invitation et fais-la accepter par un joueur
4. cree ou valide un personnage joueur
5. cree une scene et publie-la
6. lance un combat et attribue une recompense

## Scripts utiles

- `npm.cmd run build`
- `npm.cmd run check`
- `npm.cmd run prisma:generate`
- `npm.cmd run prisma:migrate`
- `npm.cmd run prisma:seed`
# newMJ
