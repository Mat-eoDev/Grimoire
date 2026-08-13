import type { Response } from "express";

import { env } from "../env.js";

export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function parseCookies(header?: string) {
  if (!header) {
    return {};
  }

  return header.split(";").reduce<Record<string, string>>((accumulator, chunk) => {
    const [key, ...rest] = chunk.trim().split("=");

    if (!key) {
      return accumulator;
    }

    accumulator[key] = decodeURIComponent(rest.join("="));
    return accumulator;
  }, {});
}

export function assertString(value: unknown, fieldName: string, maxLength = 2000) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `Champ invalide: ${fieldName}`);
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    throw new HttpError(400, `Champ trop long: ${fieldName} (max ${maxLength} caracteres)`);
  }

  return trimmed;
}

export function optionalString(value: unknown, maxLength = 5000) {
  if (value == null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "Valeur texte invalide");
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    throw new HttpError(400, `Valeur texte trop longue (max ${maxLength} caracteres)`);
  }

  return trimmed;
}

export function optionalNumber(value: unknown) {
  if (value == null || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    throw new HttpError(400, "Valeur numerique invalide");
  }

  return parsed;
}

/**
 * Lit un entier borne. `Math.max(1, Number(x))` ne suffisait pas : `Number("abc")`
 * vaut NaN, et NaN traverse toutes les comparaisons sans les declencher — la valeur
 * finissait dans Prisma et remontait en 500 au lieu d'un 400 explicite.
 */
export function assertInteger(
  value: unknown,
  fieldName: string,
  { min = 1, max = 1000, fallback }: { min?: number; max?: number; fallback?: number } = {}
) {
  if ((value == null || value === "") && fallback !== undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new HttpError(400, `Champ invalide: ${fieldName} (entier attendu)`);
  }

  if (parsed < min || parsed > max) {
    throw new HttpError(400, `Champ hors bornes: ${fieldName} (entre ${min} et ${max})`);
  }

  return parsed;
}

export function requireArray(value: unknown, fieldName: string) {
  if (!Array.isArray(value)) {
    throw new HttpError(400, `Champ invalide: ${fieldName}`);
  }

  return value;
}

export function setSessionCookie(response: Response, cookieName: string, token: string) {
  response.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 7
  });
}

export function clearSessionCookie(response: Response, cookieName: string) {
  response.cookie(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    expires: new Date(0)
  });
}

