import assert from "node:assert/strict";
import test from "node:test";

import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../lib/http.js";
import { rateLimit } from "./rateLimit.js";

const noopResponse = { setHeader() {} } as unknown as Response;

function requestFrom(ip: string): Request {
  return { ip } as unknown as Request;
}

test("rateLimit: autorise sous le seuil puis renvoie 429", () => {
  const middleware = rateLimit({ windowMs: 60_000, max: 3 });
  const errors: unknown[] = [];
  const next: NextFunction = ((error?: unknown) => {
    errors.push(error);
  }) as NextFunction;
  const request = requestFrom("1.2.3.4");

  for (let i = 0; i < 3; i += 1) {
    middleware(request, noopResponse, next);
  }
  assert.equal(errors.filter(Boolean).length, 0, "les 3 premieres passent");

  middleware(request, noopResponse, next); // 4e = au-dela du seuil
  const last = errors[errors.length - 1];
  assert.ok(last instanceof HttpError);
  assert.equal((last as HttpError).statusCode, 429);
});

test("rateLimit: des IP differentes ont des compteurs independants", () => {
  const middleware = rateLimit({ windowMs: 60_000, max: 1 });
  const errors: unknown[] = [];
  const next: NextFunction = ((error?: unknown) => {
    errors.push(error);
  }) as NextFunction;

  middleware(requestFrom("10.0.0.1"), noopResponse, next);
  middleware(requestFrom("10.0.0.2"), noopResponse, next);
  assert.equal(errors.filter(Boolean).length, 0);
});
