import { Router } from "express";

import { assertString, HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const inventoryRouter = Router();

function serializeEntry(entry: {
  id: string;
  quantity: number;
  equipped: boolean;
  bonusMaxHp: number;
  bonusAttack: number;
  bonusDefense: number;
  bonusSpeed: number;
  bonusMagic: number;
  effectHp: number;
  item: { id: string; slug: string; name: string; type: string; imageFile: string; description: string; equipable: boolean };
}) {
  return {
    id: entry.id,
    quantity: entry.quantity,
    equipped: entry.equipped,
    bonusMaxHp: entry.bonusMaxHp,
    bonusAttack: entry.bonusAttack,
    bonusDefense: entry.bonusDefense,
    bonusSpeed: entry.bonusSpeed,
    bonusMagic: entry.bonusMagic,
    effectHp: entry.effectHp,
    item: entry.item,
  };
}

async function requireMember(campaignId: string, userId: string) {
  const member = await prisma.campaignMember.findUnique({
    where: { campaignId_userId: { campaignId, userId } },
  });
  if (!member) throw new HttpError(403, "Tu ne participes pas a cette partie");
  return member;
}

async function requireGm(campaignId: string, userId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new HttpError(404, "Partie introuvable");
  if (campaign.gmUserId !== userId) throw new HttpError(403, "Seul le MJ peut effectuer cette action");
  return campaign;
}

// GET /campaigns/:campaignId/items — liste tous les items disponibles
inventoryRouter.get("/campaigns/:campaignId/items", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireMember(request.params.campaignId, auth.user.id);
    const items = await prisma.item.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] });
    response.json({ items });
  } catch (error) {
    next(error);
  }
});

// GET /campaigns/:campaignId/inventory — inventaire du joueur connecté
inventoryRouter.get("/campaigns/:campaignId/inventory", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireMember(request.params.campaignId, auth.user.id);

    const entries = await prisma.inventoryEntry.findMany({
      where: { campaignId: request.params.campaignId, userId: auth.user.id },
      include: { item: true },
      orderBy: { createdAt: "asc" },
    });

    response.json({ entries: entries.map(serializeEntry) });
  } catch (error) {
    next(error);
  }
});

// GET /campaigns/:campaignId/inventory/all — MJ : inventaires de tous les joueurs
inventoryRouter.get("/campaigns/:campaignId/inventory/all", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireGm(request.params.campaignId, auth.user.id);

    const entries = await prisma.inventoryEntry.findMany({
      where: { campaignId: request.params.campaignId },
      include: { item: true, user: { select: { id: true, username: true } } },
      orderBy: { createdAt: "asc" },
    });

    const byPlayer: Record<string, { userId: string; username: string; entries: ReturnType<typeof serializeEntry>[] }> = {};
    for (const entry of entries) {
      if (!byPlayer[entry.userId]) {
        byPlayer[entry.userId] = { userId: entry.userId, username: entry.user.username, entries: [] };
      }
      byPlayer[entry.userId].entries.push(serializeEntry(entry));
    }

    response.json({ players: Object.values(byPlayer) });
  } catch (error) {
    next(error);
  }
});

// POST /campaigns/:campaignId/inventory/give — MJ donne un item à un joueur
inventoryRouter.post("/campaigns/:campaignId/inventory/give", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireGm(request.params.campaignId, auth.user.id);

    const body = request.body as Record<string, unknown>;
    const playerId = assertString(body.playerId, "playerId");
    const itemSlug = assertString(body.itemSlug, "itemSlug");
    const quantity = typeof body.quantity === "number" && body.quantity > 0 ? body.quantity : 1;

    function toBonus(val: unknown) {
      const n = Number(val);
      return isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    }

    const bonusMaxHp   = toBonus(body.bonusMaxHp);
    const bonusAttack  = toBonus(body.bonusAttack);
    const bonusDefense = toBonus(body.bonusDefense);
    const bonusSpeed   = toBonus(body.bonusSpeed);
    const bonusMagic   = toBonus(body.bonusMagic);
    const effectHp     = toBonus(body.effectHp);

    await requireMember(request.params.campaignId, playerId);

    const item = await prisma.item.findUnique({ where: { slug: itemSlug } });
    if (!item) throw new HttpError(404, "Item introuvable");

    // Toujours créer une nouvelle entrée pour permettre plusieurs copies avec des bonus différents
    const entry = await prisma.inventoryEntry.create({
      data: {
        campaignId: request.params.campaignId,
        userId: playerId,
        itemId: item.id,
        quantity,
        bonusMaxHp,
        bonusAttack,
        bonusDefense,
        bonusSpeed,
        bonusMagic,
        effectHp,
      },
      include: { item: true },
    });

    response.status(201).json({ entry: serializeEntry(entry) });
  } catch (error) {
    next(error);
  }
});

// PATCH /campaigns/:campaignId/inventory/:entryId/equip — équiper / déséquiper
inventoryRouter.patch("/campaigns/:campaignId/inventory/:entryId/equip", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireMember(request.params.campaignId, auth.user.id);

    const existing = await prisma.inventoryEntry.findUnique({
      where: { id: request.params.entryId },
      include: { item: true },
    });

    if (!existing || existing.userId !== auth.user.id || existing.campaignId !== request.params.campaignId) {
      throw new HttpError(404, "Entree d'inventaire introuvable");
    }

    if (!existing.item.equipable) {
      throw new HttpError(400, "Cet item ne peut pas etre equipe");
    }

    const nowEquipped = !existing.equipped;

    // Déséquiper les items du même type si on équipe
    if (nowEquipped) {
      const sameType = await prisma.inventoryEntry.findMany({
        where: {
          campaignId: request.params.campaignId,
          userId: auth.user.id,
          equipped: true,
          item: { type: existing.item.type },
          NOT: { id: existing.id },
        },
        include: { item: true },
      });
      for (const e of sameType) {
        await prisma.inventoryEntry.update({ where: { id: e.id }, data: { equipped: false } });
      }
    }

    const entry = await prisma.inventoryEntry.update({
      where: { id: existing.id },
      data: { equipped: nowEquipped },
      include: { item: true },
    });

    response.json({ entry: serializeEntry(entry) });
  } catch (error) {
    next(error);
  }
});

// DELETE /campaigns/:campaignId/inventory/:entryId — retirer un item
inventoryRouter.delete("/campaigns/:campaignId/inventory/:entryId", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const member = await requireMember(request.params.campaignId, auth.user.id);

    const existing = await prisma.inventoryEntry.findUnique({ where: { id: request.params.entryId } });

    if (!existing || existing.campaignId !== request.params.campaignId) {
      throw new HttpError(404, "Entree d'inventaire introuvable");
    }

    // Le joueur peut retirer ses propres items, le MJ peut retirer n'importe quoi
    const campaign = await prisma.campaign.findUnique({ where: { id: request.params.campaignId } });
    const isGm = campaign?.gmUserId === auth.user.id;
    if (!isGm && existing.userId !== auth.user.id) {
      throw new HttpError(403, "Action non autorisee");
    }

    await prisma.inventoryEntry.delete({ where: { id: existing.id } });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

// POST /campaigns/:campaignId/inventory/:entryId/use — utiliser un consommable
inventoryRouter.post("/campaigns/:campaignId/inventory/:entryId/use", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireMember(request.params.campaignId, auth.user.id);

    const entry = await prisma.inventoryEntry.findUnique({
      where: { id: request.params.entryId },
      include: { item: true },
    });

    if (!entry || entry.userId !== auth.user.id || entry.campaignId !== request.params.campaignId) {
      throw new HttpError(404, "Entree d'inventaire introuvable");
    }

    if (entry.item.type !== "CONSUMABLE") {
      throw new HttpError(400, "Cet item n'est pas un consommable");
    }

    const sheet = await prisma.characterSheet.findUnique({
      where: { userId_campaignId: { userId: auth.user.id, campaignId: request.params.campaignId } },
    });

    if (!sheet) throw new HttpError(404, "Fiche personnage introuvable");

    const newHp = Math.min(sheet.hp + entry.effectHp, sheet.maxHp);
    const updatedSheet = await prisma.characterSheet.update({
      where: { userId_campaignId: { userId: auth.user.id, campaignId: request.params.campaignId } },
      data: { hp: newHp },
    });

    if (entry.quantity > 1) {
      await prisma.inventoryEntry.update({ where: { id: entry.id }, data: { quantity: entry.quantity - 1 } });
    } else {
      await prisma.inventoryEntry.delete({ where: { id: entry.id } });
    }

    response.json({ hp: updatedSheet.hp, maxHp: updatedSheet.maxHp });
  } catch (error) {
    next(error);
  }
});

// GET /campaigns/:campaignId/players/:userId/inventory — MJ : inventaire d'un joueur spécifique
inventoryRouter.get("/campaigns/:campaignId/players/:userId/inventory", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireGm(request.params.campaignId, auth.user.id);

    const entries = await prisma.inventoryEntry.findMany({
      where: { campaignId: request.params.campaignId, userId: request.params.userId },
      include: { item: true },
      orderBy: { createdAt: "asc" },
    });

    response.json({ entries: entries.map(serializeEntry) });
  } catch (error) {
    next(error);
  }
});

// GET /campaigns/:campaignId/players/:userId/character — MJ : fiche d'un joueur spécifique
inventoryRouter.get("/campaigns/:campaignId/players/:userId/character", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireGm(request.params.campaignId, auth.user.id);

    const sheet = await prisma.characterSheet.findUnique({
      where: {
        userId_campaignId: {
          userId: request.params.userId,
          campaignId: request.params.campaignId,
        },
      },
    });

    if (!sheet) throw new HttpError(404, "Fiche personnage introuvable");

    response.json({ sheet });
  } catch (error) {
    next(error);
  }
});
