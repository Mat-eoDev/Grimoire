import assert from "node:assert/strict";
import test from "node:test";

import { getRollOutcome } from "./rollOutcome.js";

const seuils = { totalFailureMax: 4, successMin: 12, totalSuccessMin: 18 };

test("getRollOutcome: null tant que le de n'est pas lance", () => {
  assert.equal(getRollOutcome({ result: null, ...seuils }), null);
});

test("getRollOutcome: echec total sous le seuil bas", () => {
  assert.equal(getRollOutcome({ result: 1, ...seuils }), "TOTAL_FAILURE");
  assert.equal(getRollOutcome({ result: 4, ...seuils }), "TOTAL_FAILURE");
});

test("getRollOutcome: echec entre les seuils", () => {
  assert.equal(getRollOutcome({ result: 5, ...seuils }), "FAILURE");
  assert.equal(getRollOutcome({ result: 11, ...seuils }), "FAILURE");
});

test("getRollOutcome: reussite au seuil de reussite", () => {
  assert.equal(getRollOutcome({ result: 12, ...seuils }), "SUCCESS");
  assert.equal(getRollOutcome({ result: 17, ...seuils }), "SUCCESS");
});

test("getRollOutcome: reussite totale au seuil haut (cas limite)", () => {
  assert.equal(getRollOutcome({ result: 18, ...seuils }), "TOTAL_SUCCESS");
  assert.equal(getRollOutcome({ result: 20, ...seuils }), "TOTAL_SUCCESS");
});
