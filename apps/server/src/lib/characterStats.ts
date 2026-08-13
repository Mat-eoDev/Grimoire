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

export type EquipmentBonuses = {
  bonusMaxHp:   number;
  bonusAttack:  number;
  bonusDefense: number;
  bonusSpeed:   number;
  bonusMagic:   number;
};

const EMPTY_BONUSES: EquipmentBonuses = {
  bonusMaxHp: 0,
  bonusAttack: 0,
  bonusDefense: 0,
  bonusSpeed: 0,
  bonusMagic: 0,
};

/** Somme les bonus d'un ensemble d'entrees d'inventaire (typiquement celles equipees). */
export function sumEquipmentBonuses(entries: Partial<EquipmentBonuses>[]): EquipmentBonuses {
  return entries.reduce<EquipmentBonuses>(
    (total, entry) => ({
      bonusMaxHp:   total.bonusMaxHp   + (entry.bonusMaxHp   ?? 0),
      bonusAttack:  total.bonusAttack  + (entry.bonusAttack  ?? 0),
      bonusDefense: total.bonusDefense + (entry.bonusDefense ?? 0),
      bonusSpeed:   total.bonusSpeed   + (entry.bonusSpeed   ?? 0),
      bonusMagic:   total.bonusMagic   + (entry.bonusMagic   ?? 0),
    }),
    { ...EMPTY_BONUSES }
  );
}

/**
 * Statistiques effectives d'un personnage : stats de base de sa classe + bonus de
 * l'equipement porte. Regle metier pure, sans dependance a Express ni a Prisma.
 *
 * Ces valeurs sont ensuite persistees sur la fiche (voir lib/sheetStats.ts) : la
 * contrainte CHECK "hp <= maxHp" et le trigger character_sheet_hp_guard s'appliquent
 * au plus pres de la donnee, donc le plafond de PV doit exister en base et pas
 * seulement dans une addition faite a l'affichage.
 */
export function getEffectiveStats(charId: number, equipped: Partial<EquipmentBonuses>[]): BaseStats {
  const base  = getBaseStats(charId);
  const bonus = sumEquipmentBonuses(equipped);

  return {
    hp:      base.hp,
    maxHp:   base.maxHp   + bonus.bonusMaxHp,
    attack:  base.attack  + bonus.bonusAttack,
    defense: base.defense + bonus.bonusDefense,
    speed:   base.speed   + bonus.bonusSpeed,
    magic:   base.magic   + bonus.bonusMagic,
    level:   base.level,
  };
}
