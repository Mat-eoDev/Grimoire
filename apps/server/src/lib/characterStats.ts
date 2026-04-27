export type BaseStats = {
  hp:      number;
  maxHp:   number;
  attack:  number;
  defense: number;
  speed:   number;
  magic:   number;
  level:   number;
};

export const CHARACTER_BASE_STATS: Record<number, BaseStats> = {
  1: { hp: 65,  maxHp: 65,  attack: 18, defense: 8,  speed: 20, magic: 4,  level: 1 }, // Assassin
  2: { hp: 120, maxHp: 120, attack: 14, defense: 20, speed: 8,  magic: 2,  level: 1 }, // Chevalier
  3: { hp: 80,  maxHp: 80,  attack: 15, defense: 10, speed: 17, magic: 12, level: 1 }, // Elfe
  4: { hp: 55,  maxHp: 55,  attack: 6,  defense: 5,  speed: 9,  magic: 25, level: 1 }, // Mage
};

export const CHARACTER_NAMES: Record<number, string> = {
  1: "Assassin",
  2: "Chevalier",
  3: "Elfe",
  4: "Mage",
};

export function getBaseStats(charId: number): BaseStats {
  const stats = CHARACTER_BASE_STATS[charId];
  if (!stats) throw new Error(`Personnage ${charId} inconnu`);
  return stats;
}
