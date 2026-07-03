import assert from "node:assert/strict";
import test from "node:test";

import { getBaseStats } from "./characterStats.js";

test("getBaseStats renvoie des stats coherentes pour chaque classe", () => {
  for (const charId of [1, 2, 3, 4]) {
    const stats = getBaseStats(charId);
    assert.equal(stats.hp, stats.maxHp, "hp initial = maxHp");
    assert.ok(stats.hp > 0);
    assert.equal(stats.level, 1);
  }
});

test("getBaseStats: le chevalier est plus resistant que le mage", () => {
  assert.ok(getBaseStats(2).maxHp > getBaseStats(4).maxHp);
});

test("getBaseStats: le mage a plus de magie que l'assassin", () => {
  assert.ok(getBaseStats(4).magic > getBaseStats(1).magic);
});

test("getBaseStats: identifiant inconnu leve une erreur (cas limite)", () => {
  assert.throws(() => getBaseStats(999));
});
