import assert from "node:assert/strict";
import test from "node:test";

import { assertString, optionalNumber, optionalString } from "./http.js";

test("assertString: nettoie les espaces d'une valeur valide", () => {
  assert.equal(assertString("  hello  ", "champ"), "hello");
});

test("assertString: rejette une valeur vide ou non-texte (cas limite)", () => {
  assert.throws(() => assertString("   ", "champ"));
  assert.throws(() => assertString(123, "champ"));
  assert.throws(() => assertString(undefined, "champ"));
});

test("assertString: rejette une chaine trop longue (cas limite)", () => {
  assert.throws(() => assertString("a".repeat(2001), "champ", 2000));
  assert.equal(assertString("a".repeat(2000), "champ", 2000).length, 2000);
});

test("optionalString: vide -> undefined, valeur -> trim, trop long -> erreur", () => {
  assert.equal(optionalString(""), undefined);
  assert.equal(optionalString(null), undefined);
  assert.equal(optionalString("  salut "), "salut");
  assert.throws(() => optionalString("a".repeat(6000), 5000));
});

test("optionalNumber: parse un nombre valide, rejette l'invalide", () => {
  assert.equal(optionalNumber(""), undefined);
  assert.equal(optionalNumber("42"), 42);
  assert.throws(() => optionalNumber("abc"));
});
