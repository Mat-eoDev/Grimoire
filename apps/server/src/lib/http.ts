import type { Response } from "express";

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

export function assertString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `Champ invalide: ${fieldName}`);
  }

  return value.trim();
}

export function optionalString(value: unknown) {
  if (value == null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "Valeur texte invalide");
  }

  return value.trim();
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
    secure: false,
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 7
  });
}

export function clearSessionCookie(response: Response, cookieName: string) {
  response.cookie(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    expires: new Date(0)
  });
}

