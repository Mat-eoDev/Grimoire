import assert from "node:assert/strict";
import test from "node:test";

import { getBaseStats, getEffectiveStats, sumEquipmentBonuses } from "./characterStats.js";

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

test("sumEquipmentBonuses: additionne plusieurs objets, ignore les champs absents", () => {
  const total = sumEquipmentBonuses([
    { bonusAttack: 3, bonusMaxHp: 10 },
    { bonusAttack: 2, bonusDefense: 5 },
    {}
  ]);

  assert.equal(total.bonusAttack, 5);
  assert.equal(total.bonusMaxHp, 10);
  assert.equal(total.bonusDefense, 5);
  assert.equal(total.bonusMagic, 0);
});

test("sumEquipmentBonuses: sans equipement, tous les bonus sont nuls (cas limite)", () => {
  const total = sumEquipmentBonuses([]);
  assert.deepEqual(total, {
    bonusMaxHp: 0,
    bonusAttack: 0,
    bonusDefense: 0,
    bonusSpeed: 0,
    bonusMagic: 0
  });
});

test("getEffectiveStats: l'equipement s'ajoute aux stats de base", () => {
  const base = getBaseStats(2); // Chevalier
  const effective = getEffectiveStats(2, [{ bonusMaxHp: 20, bonusDefense: 4 }]);

  assert.equal(effective.maxHp, base.maxHp + 20);
  assert.equal(effective.defense, base.defense + 4);
  assert.equal(effective.attack, base.attack, "une stat sans bonus ne bouge pas");
});

test("getEffectiveStats: sans equipement, on retrouve exactement les stats de base", () => {
  assert.deepEqual(getEffectiveStats(4, []), getBaseStats(4));
});
