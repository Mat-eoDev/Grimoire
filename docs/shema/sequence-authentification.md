# Sequence d'authentification

## Objectif

Montrer le fonctionnement de l'inscription, de la connexion et de la session serveur.

## Competences demontrees

- Developpement d'une application securisee
- Gestion des mots de passe
- Gestion des sessions
- Protection par cookie `HttpOnly`

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant W as Frontend React
    participant A as API Express
    participant P as Module password/session
    participant D as PostgreSQL via Prisma

    U->>W: Saisit email, pseudo, mot de passe
    W->>A: POST /auth/register
    A->>A: Valide les champs
    A->>D: Verifie email/pseudo existants
    D-->>A: Aucun compte existant
    A->>P: Hash du mot de passe avec scrypt
    A->>D: Cree User
    A->>P: Cree une session
    P->>D: Enregistre tokenHash + expiration
    A-->>W: Set-Cookie HttpOnly + user public
    W-->>U: Utilisateur connecte
```

## Variante connexion

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant W as Frontend React
    participant A as API Express
    participant P as Module password/session
    participant D as PostgreSQL via Prisma

    U->>W: Saisit email et mot de passe
    W->>A: POST /auth/login
    A->>D: Recherche User par email
    D-->>A: User + passwordHash
    A->>P: Verifie le mot de passe
    P-->>A: Mot de passe valide
    A->>P: Cree une session serveur
    P->>D: Enregistre tokenHash
    A-->>W: Cookie HttpOnly
    W->>A: GET /auth/me
    A->>D: Charge utilisateur et campagnes
    A-->>W: SessionPayload
```

## Points de securite

- Le mot de passe n'est jamais stocke en clair.
- Le cookie de session est `HttpOnly`, donc non lisible directement par JavaScript.
- Les routes protegees utilisent `requireAuth`.

