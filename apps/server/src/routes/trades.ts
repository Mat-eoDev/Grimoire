import { Prisma } from "@prisma/client";
import { Router } from "express";

import { assertInteger, HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { sseBroadcast } from "../lib/sseHub.js";

export const tradesRouter = Router();

async function requireMember(campaignId: string, userId: string) {
  const member = await prisma.campaignMember.findUnique({
    where: { campaignId_userId: { campaignId, userId } }
  });
  if (!member) throw new HttpError(403, "Tu ne participes pas a cette partie");
  return member;
}

function serializeTrade(trade: {
  id: string;
  fromUserId: string;
  toUserId: string;
  offeredEntryId: string;
  offeredQty: number;
  requestedEntryId: string | null;
  requestedQty: number;
  status: string;
  createdAt: Date;
}) {
  return {
    id: trade.id,
    fromUserId: trade.fromUserId,
    toUserId: trade.toUserId,
    offeredEntryId: trade.offeredEntryId,
    offeredQty: trade.offeredQty,
    requestedEntryId: trade.requestedEntryId,
    requestedQty: trade.requestedQty,
    status: trade.status,
    createdAt: trade.createdAt
  };
}

// Transfere tout ou partie d'une entree d'inventaire, de maniere atomique.
// Doit s'executer dans une transaction (tx) : les update conditionnels
// (WHERE sur quantite/proprietaire) empechent la double-depense concurrente.
async function transferEntry(
  tx: Prisma.TransactionClient,
  entryId: string,
  fromUserId: string,
  toUserId: string,
  qty: number,
  campaignId: string
) {
  const entry = await tx.inventoryEntry.findUnique({
    where: { id: entryId },
    include: { item: true }
  });
  if (!entry || entry.userId !== fromUserId || entry.campaignId !== campaignId) {
    throw new HttpError(400, "Item introuvable dans l'inventaire de l'expediteur");
  }
  if (entry.quantity < qty) {
    throw new HttpError(400, "Quantite insuffisante dans l'inventaire");
  }

  if (entry.quantity === qty) {
    // Deplace toute la pile — echoue si la pile a change de proprietaire/quantite entre-temps.
    const moved = await tx.inventoryEntry.updateMany({
      where: { id: entry.id, userId: fromUserId, campaignId, quantity: qty },
      data: { userId: toUserId, equipped: false }
    });
    if (moved.count !== 1) {
      throw new HttpError(409, "Inventaire modifie entre-temps, reessaie");
    }
  } else {
    // Decrement atomique conditionnel : n'aboutit que s'il reste assez de quantite.
    const decremented = await tx.inventoryEntry.updateMany({
      where: { id: entry.id, userId: fromUserId, campaignId, quantity: { gte: qty } },
      data: { quantity: { decrement: qty } }
    });
    if (decremented.count !== 1) {
      throw new HttpError(409, "Inventaire modifie entre-temps, reessaie");
    }
    await tx.inventoryEntry.create({
      data: {
        campaignId,
        userId: toUserId,
        itemId: entry.itemId,
        quantity: qty,
        bonusMaxHp: entry.bonusMaxHp,
        bonusAttack: entry.bonusAttack,
        bonusDefense: entry.bonusDefense,
        bonusSpeed: entry.bonusSpeed,
        bonusMagic: entry.bonusMagic,
        effectHp: entry.effectHp
      }
    });
  }
}

// POST /campaigns/:campaignId/inventory/player-give — don direct sans confirmation
tradesRouter.post("/campaigns/:campaignId/inventory/player-give", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireMember(request.params.campaignId, auth.user.id);

    const body = request.body as Record<string, unknown>;
    const entryId = String(body.entryId ?? "");
    const toUserId = String(body.toUserId ?? "");
    const qty = assertInteger(body.qty, "qty", { min: 1, max: 999, fallback: 1 });

    if (!entryId || !toUserId) throw new HttpError(400, "entryId et toUserId requis");

    await requireMember(request.params.campaignId, toUserId);
    if (toUserId === auth.user.id) throw new HttpError(400, "Tu ne peux pas te donner un objet a toi-meme");

    await prisma.$transaction((tx) =>
      transferEntry(tx, entryId, auth.user.id, toUserId, qty, request.params.campaignId)
    );

    const toUser = await prisma.user.findUnique({ where: { id: toUserId }, select: { username: true } });
    sseBroadcast(request.params.campaignId, {
      type: "trade:gift",
      toUserId,
      fromUserId: auth.user.id,
      message: `${auth.user.username} t'a donne un objet !`
    });

    response.json({ ok: true, to: toUser?.username });
  } catch (error) {
    next(error);
  }
});

// POST /campaigns/:campaignId/inventory/give-npc — don à un PNJ / civil (retrait narratif)
tradesRouter.post("/campaigns/:campaignId/inventory/give-npc", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireMember(request.params.campaignId, auth.user.id);

    const body = request.body as Record<string, unknown>;
    const entryId = String(body.entryId ?? "");
    const targetElementId = body.targetElementId ? String(body.targetElementId) : "";
    const qty = assertInteger(body.qty, "qty", { min: 1, max: 999, fallback: 1 });

    if (!entryId) throw new HttpError(400, "entryId requis");

    const entry = await prisma.inventoryEntry.findUnique({
      where: { id: entryId },
      include: { item: true }
    });
    if (!entry || entry.userId !== auth.user.id || entry.campaignId !== request.params.campaignId) {
      throw new HttpError(400, "Tu ne possedes pas cet objet");
    }
    if (entry.quantity < qty) throw new HttpError(400, "Quantite insuffisante");

    // La cible n'a pas d'inventaire réel : on récupère juste son nom pour la narration.
    let targetName = "un personnage de la scene";
    if (targetElementId) {
      const target = await prisma.sceneElement.findFirst({
        where: { id: targetElementId, campaignId: request.params.campaignId }
      });
      if (target) targetName = target.name;
    }

    // Retire l'objet de l'inventaire du joueur (le don est purement narratif).
    if (entry.quantity === qty) {
      await prisma.inventoryEntry.delete({ where: { id: entry.id } });
    } else {
      await prisma.inventoryEntry.update({ where: { id: entry.id }, data: { quantity: entry.quantity - qty } });
    }

    sseBroadcast(request.params.campaignId, {
      type: "inventory:gift-npc",
      fromUserId: auth.user.id,
      message: `${auth.user.username} donne ${entry.item.name} a ${targetName}.`
    });

    response.json({ ok: true, to: targetName, item: entry.item.name });
  } catch (error) {
    next(error);
  }
});

// GET /campaigns/:campaignId/trades/pending — offres en attente pour l'utilisateur connecté
tradesRouter.get("/campaigns/:campaignId/trades/pending", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireMember(request.params.campaignId, auth.user.id);

    const trades = await prisma.tradeOffer.findMany({
      where: {
        campaignId: request.params.campaignId,
        status: "PENDING",
        OR: [{ fromUserId: auth.user.id }, { toUserId: auth.user.id }]
      },
      orderBy: { createdAt: "desc" }
    });

    const userIds = [...new Set(trades.flatMap((t) => [t.fromUserId, t.toUserId]))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true }
    });
    const usersMap = Object.fromEntries(users.map((u) => [u.id, u.username]));

    const entryIds = [...new Set(
      trades.flatMap((t) => [t.offeredEntryId, t.requestedEntryId].filter(Boolean) as string[])
    )];
    const entries = await prisma.inventoryEntry.findMany({
      where: { id: { in: entryIds } },
      include: { item: true }
    });
    const entriesMap = Object.fromEntries(entries.map((e) => [e.id, e]));

    response.json({
      trades: trades.map((t) => ({
        ...serializeTrade(t),
        fromUsername: usersMap[t.fromUserId] ?? "?",
        toUsername: usersMap[t.toUserId] ?? "?",
        offeredEntry: entriesMap[t.offeredEntryId] ?? null,
        requestedEntry: t.requestedEntryId ? (entriesMap[t.requestedEntryId] ?? null) : null
      }))
    });
  } catch (error) {
    next(error);
  }
});

// POST /campaigns/:campaignId/trades — proposer un échange
tradesRouter.post("/campaigns/:campaignId/trades", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireMember(request.params.campaignId, auth.user.id);

    const body = request.body as Record<string, unknown>;
    const toUserId = String(body.toUserId ?? "");
    const offeredEntryId = String(body.offeredEntryId ?? "");
    const offeredQty = assertInteger(body.offeredQty, "offeredQty", { min: 1, max: 999, fallback: 1 });
    const requestedEntryId = body.requestedEntryId ? String(body.requestedEntryId) : null;
    const requestedQty = assertInteger(body.requestedQty, "requestedQty", { min: 1, max: 999, fallback: 1 });

    if (!toUserId || !offeredEntryId) throw new HttpError(400, "toUserId et offeredEntryId requis");
    if (toUserId === auth.user.id) throw new HttpError(400, "Tu ne peux pas echanger avec toi-meme");

    await requireMember(request.params.campaignId, toUserId);

    const offeredEntry = await prisma.inventoryEntry.findUnique({ where: { id: offeredEntryId }, include: { item: true } });
    if (!offeredEntry || offeredEntry.userId !== auth.user.id || offeredEntry.campaignId !== request.params.campaignId) {
      throw new HttpError(400, "Tu ne possedes pas cet objet");
    }
    if (offeredEntry.quantity < offeredQty) throw new HttpError(400, "Quantite insuffisante");

    if (requestedEntryId) {
      const reqEntry = await prisma.inventoryEntry.findUnique({ where: { id: requestedEntryId } });
      if (!reqEntry || reqEntry.userId !== toUserId || reqEntry.campaignId !== request.params.campaignId) {
        throw new HttpError(400, "L'autre joueur ne possede pas cet objet");
      }
      if (reqEntry.quantity < requestedQty) throw new HttpError(400, "L'autre joueur n'a pas assez de cet objet");
    }

    const trade = await prisma.tradeOffer.create({
      data: {
        campaignId: request.params.campaignId,
        fromUserId: auth.user.id,
        toUserId,
        offeredEntryId,
        offeredQty,
        requestedEntryId,
        requestedQty
      }
    });

    sseBroadcast(request.params.campaignId, {
      type: "trade:offered",
      tradeId: trade.id,
      toUserId,
      fromUserId: auth.user.id,
      fromUsername: auth.user.username
    });

    response.status(201).json({ trade: serializeTrade(trade) });
  } catch (error) {
    next(error);
  }
});

// POST /campaigns/:campaignId/trades/:tradeId/accept
tradesRouter.post("/campaigns/:campaignId/trades/:tradeId/accept", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireMember(request.params.campaignId, auth.user.id);

    const trade = await prisma.tradeOffer.findUnique({ where: { id: request.params.tradeId } });
    if (!trade || trade.campaignId !== request.params.campaignId) throw new HttpError(404, "Offre introuvable");
    if (trade.toUserId !== auth.user.id) throw new HttpError(403, "Tu n'es pas le destinataire de cette offre");
    if (trade.status !== "PENDING") throw new HttpError(400, "Cette offre n'est plus en attente");

    // Tout se joue dans une seule transaction : claim de l'offre, les deux transferts
    // et l'annulation en cascade. Si un transfert echoue, tout est annule (pas de duplication).
    await prisma.$transaction(async (tx) => {
      // Verrou logique : seule la premiere acceptation concurrente passe.
      const claimed = await tx.tradeOffer.updateMany({
        where: { id: trade.id, status: "PENDING" },
        data: { status: "ACCEPTED" }
      });
      if (claimed.count !== 1) {
        throw new HttpError(400, "Cette offre n'est plus en attente");
      }

      await transferEntry(tx, trade.offeredEntryId, trade.fromUserId, trade.toUserId, trade.offeredQty, request.params.campaignId);

      if (trade.requestedEntryId) {
        await transferEntry(tx, trade.requestedEntryId, trade.toUserId, trade.fromUserId, trade.requestedQty, request.params.campaignId);
      }

      // Annule les autres offres en attente portant sur l'objet desormais transfere.
      await tx.tradeOffer.updateMany({
        where: {
          id: { not: trade.id },
          campaignId: request.params.campaignId,
          status: "PENDING",
          OR: [
            { offeredEntryId: trade.offeredEntryId },
            { requestedEntryId: trade.offeredEntryId }
          ]
        },
        data: { status: "CANCELLED" }
      });
    });

    sseBroadcast(request.params.campaignId, {
      type: "trade:accepted",
      tradeId: trade.id,
      fromUserId: trade.fromUserId,
      toUserId: trade.toUserId
    });

    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// POST /campaigns/:campaignId/trades/:tradeId/refuse
tradesRouter.post("/campaigns/:campaignId/trades/:tradeId/refuse", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireMember(request.params.campaignId, auth.user.id);

    const trade = await prisma.tradeOffer.findUnique({ where: { id: request.params.tradeId } });
    if (!trade || trade.campaignId !== request.params.campaignId) throw new HttpError(404, "Offre introuvable");
    if (trade.toUserId !== auth.user.id) throw new HttpError(403, "Tu n'es pas le destinataire de cette offre");
    if (trade.status !== "PENDING") throw new HttpError(400, "Cette offre n'est plus en attente");

    await prisma.tradeOffer.update({ where: { id: trade.id }, data: { status: "REFUSED" } });

    sseBroadcast(request.params.campaignId, {
      type: "trade:refused",
      tradeId: trade.id,
      fromUserId: trade.fromUserId,
      toUserId: trade.toUserId
    });

    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// POST /campaigns/:campaignId/trades/:tradeId/cancel — annuler par l'expéditeur
tradesRouter.post("/campaigns/:campaignId/trades/:tradeId/cancel", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireMember(request.params.campaignId, auth.user.id);

    const trade = await prisma.tradeOffer.findUnique({ where: { id: request.params.tradeId } });
    if (!trade || trade.campaignId !== request.params.campaignId) throw new HttpError(404, "Offre introuvable");
    if (trade.fromUserId !== auth.user.id) throw new HttpError(403, "Seul l'expediteur peut annuler");
    if (trade.status !== "PENDING") throw new HttpError(400, "Cette offre n'est plus en attente");

    await prisma.tradeOffer.update({ where: { id: trade.id }, data: { status: "CANCELLED" } });

    sseBroadcast(request.params.campaignId, {
      type: "trade:cancelled",
      tradeId: trade.id,
      toUserId: trade.toUserId
    });

    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
