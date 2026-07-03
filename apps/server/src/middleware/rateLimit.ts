import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../lib/http.js";

type Bucket = { count: number; resetAt: number };

type RateLimitOptions = {
  windowMs: number;
  max: number;
  message?: string;
};

/**
 * Limiteur de debit simple en memoire (fenetre fixe, par IP). Suffisant pour
 * une instance unique (Render free) : protege le login du bruteforce et
 * forgot-password du spam d'emails. `trust proxy` est active dans app.ts, donc
 * request.ip reflete bien l'IP client derriere le proxy de l'hebergeur.
 */
export function rateLimit({ windowMs, max, message }: RateLimitOptions) {
  const hits = new Map<string, Bucket>();

  // Purge periodique des compteurs expires pour borner la memoire.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of hits) {
      if (bucket.resetAt <= now) {
        hits.delete(key);
      }
    }
  }, windowMs);
  sweeper.unref?.();

  return function rateLimitMiddleware(request: Request, _response: Response, next: NextFunction) {
    const now = Date.now();
    const key = request.ip ?? "unknown";
    const bucket = hits.get(key);

    if (!bucket || bucket.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    bucket.count += 1;

    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      _response.setHeader("Retry-After", String(retryAfter));
      next(new HttpError(429, message ?? "Trop de requetes, reessaie plus tard"));
      return;
    }

    next();
  };
}
