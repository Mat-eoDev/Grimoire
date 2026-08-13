import type { Prisma } from "@prisma/client";

import { getEffectiveStats } from "./characterStats.js";

/**
 * Recalcule et persiste les statistiques effectives d'une fiche (stats de base de la
 * classe + bonus de l'equipement porte).
 *
 * Pourquoi persister plutot que calculer a l'affichage : les bonus n'etaient additionnes
 * que dans le composant React. Le serveur, lui, plafonnait les soins a `sheet.maxHp`
 * sans bonus — un joueur affiche "80 / 100 (+20)" ne pouvait jamais depasser 80. Et
 * comme l'invariant `hp <= maxHp` est tenu par une contrainte CHECK et un trigger
 * PostgreSQL, le plafond doit exister en base : un maxHp calcule a la volee serait
 * systematiquement rabote par le trigger.
 *
 * A appeler apres tout changement d'equipement : equiper/desequiper, suppression d'une
 * entree, transfert entre joueurs, don a un PNJ.
 *
 * Les PV courants ne sont jamais augmentes ici. Ils sont seulement ramenes sous le
 * nouveau plafond quand on retire un objet qui donnait des PV max (le trigger de la
 * base ferait de toute facon ce rabotage ; on l'ecrit explicitement pour que la valeur
 * renvoyee par cette fonction soit celle reellement stockee).
 */
export async function syncSheetStats(
  tx: Prisma.TransactionClient,
  campaignId: string,
  userId: string
) {
  const sheet = await tx.characterSheet.findUnique({
    where: { userId_campaignId: { userId, campaignId } }
  });

  // Le MJ n'a pas de fiche : rien a synchroniser.
  if (!sheet) return null;

  const equipped = await tx.inventoryEntry.findMany({
    where: { campaignId, userId, equipped: true },
    select: {
      bonusMaxHp: true,
      bonusAttack: true,
      bonusDefense: true,
      bonusSpeed: true,
      bonusMagic: true
    }
  });

  let effective;
  try {
    effective = getEffectiveStats(sheet.charId, equipped);
  } catch {
    // charId inconnu (donnee anterieure a la validation) : on laisse la fiche en l'etat.
    return sheet;
  }

  return tx.characterSheet.update({
    where: { id: sheet.id },
    data: {
      maxHp:   effective.maxHp,
      attack:  effective.attack,
      defense: effective.defense,
      speed:   effective.speed,
      magic:   effective.magic,
      hp:      Math.min(sheet.hp, effective.maxHp)
    }
  });
}
