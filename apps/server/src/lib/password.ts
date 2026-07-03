import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [salt, expected] = passwordHash.split(":");

  if (!salt || !expected) {
    return false;
  }

  const derived = scryptSync(password, salt, KEY_LENGTH);
  const expectedBuffer = Buffer.from(expected, "hex");

  if (derived.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(derived, expectedBuffer);
}

// Hash bidon (mot de passe aleatoire) calcule au demarrage. Sert a faire tourner
// scrypt meme quand l'email n'existe pas, pour egaliser le temps de reponse du
// login et empecher l'enumeration d'emails par mesure du temps.
const DUMMY_PASSWORD_HASH = hashPassword(randomBytes(32).toString("hex"));

/**
 * Verifie un mot de passe en temps ~constant, que le compte existe ou non.
 * Si `passwordHash` est absent (email inconnu), scrypt tourne quand meme contre
 * un hash bidon puis renvoie false.
 */
export function verifyPasswordOrDummy(password: string, passwordHash: string | null | undefined) {
  if (!passwordHash) {
    verifyPassword(password, DUMMY_PASSWORD_HASH);
    return false;
  }

  return verifyPassword(password, passwordHash);
}

