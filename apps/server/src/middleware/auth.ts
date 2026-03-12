import type { NextFunction, Request, Response } from "express";

import { env } from "../env.js";
import { HttpError, parseCookies } from "../lib/http.js";
import { resolveSession } from "../lib/session.js";

export async function attachAuth(request: Request, _response: Response, next: NextFunction) {
  try {
    const cookies = parseCookies(request.headers.cookie);
    const token = cookies[env.sessionCookieName];

    if (!token) {
      next();
      return;
    }

    const session = await resolveSession(token);

    if (session) {
      request.auth = {
        user: session.user,
        sessionId: session.id
      };
    }

    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(request: Request) {
  if (!request.auth) {
    throw new HttpError(401, "Authentification requise");
  }

  return request.auth;
}

