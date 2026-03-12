import assert from "node:assert/strict";
import test from "node:test";

import { hashPassword, verifyPassword } from "./password.js";

test("hashPassword + verifyPassword", () => {
  const hash = hashPassword("secret-demo");

  assert.ok(hash.includes(":"));
  assert.equal(verifyPassword("secret-demo", hash), true);
  assert.equal(verifyPassword("bad-secret", hash), false);
});

