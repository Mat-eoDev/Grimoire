import { Router } from "express";

import { HttpError } from "../lib/http.js";
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

async function transferEntry(
  entryId: string,
  fromUserId: string,
  toUserId: string,
  qty: number,
  campaignId: string
) {
  const entry = await prisma.inventoryEntry.findUnique({
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
    await prisma.inventoryEntry.update({ where: { id: entry.id }, data: { userId: toUserId, equipped: false } });
  } else {
    await prisma.inventoryEntry.update({ where: { id: entry.id }, data: { quantity: entry.quantity - qty } });
    await prisma.inventoryEntry.create({
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
    const qty = Math.max(1, Number(body.qty ?? 1));

    if (!entryId || !toUserId) throw new HttpError(400, "entryId et toUserId requis");

    await requireMember(request.params.campaignId, toUserId);
    if (toUserId === auth.user.id) throw new HttpError(400, "Tu ne peux pas te donner un objet a toi-meme");

    await transferEntry(entryId, auth.user.id, toUserId, qty, request.params.campaignId);

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
    const offeredQty = Math.max(1, Number(body.offeredQty ?? 1));
    const requestedEntryId = body.requestedEntryId ? String(body.requestedEntryId) : null;
    const requestedQty = Math.max(1, Number(body.requestedQty ?? 1));

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

    await transferEntry(trade.offeredEntryId, trade.fromUserId, trade.toUserId, trade.offeredQty, request.params.campaignId);

    if (trade.requestedEntryId) {
      await transferEntry(trade.requestedEntryId, trade.toUserId, trade.fromUserId, trade.requestedQty, request.params.campaignId);
    }

    await prisma.tradeOffer.update({ where: { id: trade.id }, data: { status: "ACCEPTED" } });
    await prisma.tradeOffer.updateMany({
      where: {
        campaignId: request.params.campaignId,
        status: "PENDING",
        OR: [
          { offeredEntryId: trade.offeredEntryId },
          { requestedEntryId: trade.offeredEntryId }
        ]
      },
      data: { status: "CANCELLED" }
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
