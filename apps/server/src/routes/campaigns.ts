import { randomBytes } from "node:crypto";

import { MemberRole, SceneElementType } from "@prisma/client";
import { Router } from "express";

import { assertString, HttpError, optionalString } from "../lib/http.js";
import { sseBroadcast, sseSubscribe, sseUnsubscribe } from "../lib/sseHub.js";
import { getBaseStats } from "../lib/characterStats.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const campaignsRouter = Router();

function generateJoinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

async function createUniqueJoinCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateJoinCode();
    const existing = await prisma.campaign.findUnique({ where: { joinCode: code } });
    if (!existing) {
      return code;
    }
  }
  throw new HttpError(500, "Impossible de generer un code de partie");
}

function serializeCampaign(campaign: {
  id: string;
  title: string;
  joinCode: string;
  status: string;
  gmUserId: string;
  startedAt: Date | null;
  endedAt: Date | null;
}) {
  return {
    id: campaign.id,
    title: campaign.title,
    joinCode: campaign.joinCode,
    status: campaign.status,
    gmUserId: campaign.gmUserId,
    startedAt: campaign.startedAt,
    endedAt: campaign.endedAt
  };
}

async function requireGmCampaign(campaignId: string, userId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });

  if (!campaign) {
    throw new HttpError(404, "Partie introuvable");
  }

  if (campaign.gmUserId !== userId) {
    throw new HttpError(403, "Seul le MJ peut modifier la scene");
  }

  if (campaign.status !== "ACTIVE") {
    throw new HttpError(400, "La campagne n'est pas en cours");
  }

  return campaign;
}

campaignsRouter.post("/campaigns", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const body = request.body as Record<string, unknown>;
    const title = assertString(body.title, "title");

    const joinCode = await createUniqueJoinCode();

    const campaign = await prisma.campaign.create({
      data: {
        gmUserId: auth.user.id,
        title,
        joinCode,
        status: "DRAFT",
        members: {
          create: {
            userId: auth.user.id,
            role: MemberRole.GM
          }
        }
      }
    });

    response.status(201).json({ campaign: serializeCampaign(campaign) });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/campaigns/join", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const body = request.body as Record<string, unknown>;
    const rawCode = assertString(body.joinCode, "joinCode");
    const joinCode = rawCode.toUpperCase();

    const campaign = await prisma.campaign.findUnique({ where: { joinCode } });

    if (!campaign) {
      throw new HttpError(404, "Code de partie introuvable");
    }

    if (campaign.status === "CLOSED") {
      throw new HttpError(400, "Cette partie est terminee");
    }

    await prisma.campaignMember.upsert({
      where: {
        campaignId_userId: {
          campaignId: campaign.id,
          userId: auth.user.id
        }
      },
      update: {},
      create: {
        campaignId: campaign.id,
        userId: auth.user.id,
        role: MemberRole.PLAYER
      }
    });

    response.status(200).json({ campaign: serializeCampaign(campaign) });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.get("/campaigns/:campaignId", async (request, response, next) => {
  try {
    const auth = requireAuth(request);

    const campaign = await prisma.campaign.findUnique({
      where: { id: request.params.campaignId },
      include: {
        gmUser: { select: { id: true, username: true } },
        characterSheets: {
          include: {
            user: { select: { id: true, username: true } }
          },
          orderBy: { updatedAt: "asc" }
        },
        sceneElements: {
          include: {
            asset: { select: { id: true, name: true, imageDataUrl: true } }
          },
          orderBy: { createdAt: "asc" }
        },
        members: {
          include: {
            user: { select: { id: true, username: true } }
          },
          orderBy: { joinedAt: "asc" }
        }
      }
    });

    if (!campaign) {
      throw new HttpError(404, "Partie introuvable");
    }

    const viewer = campaign.members.find((member) => member.userId === auth.user.id);

    if (!viewer) {
      throw new HttpError(403, "Tu ne participes pas a cette partie");
    }

    const revelationAssets = viewer.role === MemberRole.GM
      ? await prisma.revelationAsset.findMany({
          select: { id: true, type: true, name: true, imageDataUrl: true },
          orderBy: [{ type: "asc" }, { name: "asc" }]
        })
      : [];

    response.json({
      campaign: {
        id: campaign.id,
        title: campaign.title,
        joinCode: campaign.joinCode,
        status: campaign.status,
        startedAt: campaign.startedAt,
        endedAt: campaign.endedAt,
        gmUser: campaign.gmUser
      },
      viewer: {
        memberId: viewer.id,
        role: viewer.role
      },
      members: campaign.members.map((member) => ({
        id: member.id,
        role: member.role,
        isReady: member.isReady,
        joinedAt: member.joinedAt,
        user: member.user
      })),
      live: {
        scene: {
          preset: campaign.scenePreset,
          title: campaign.sceneTitle,
          text: campaign.sceneText
        },
        players: campaign.characterSheets.map((sheet) => ({
          userId: sheet.userId,
          username: sheet.user.username,
          charName: sheet.charName,
          charId: sheet.charId,
          hp: sheet.hp,
          maxHp: sheet.maxHp
        })),
        elements: campaign.sceneElements
          .filter((element) => viewer.role === MemberRole.GM || element.isVisible)
          .map((element) => ({
            id: element.id,
            type: element.type,
            name: element.name,
            description: element.description,
            quantity: element.quantity,
            isVisible: element.isVisible,
            posX: element.posX,
            posY: element.posY,
            asset: element.asset
          })),
        assets: revelationAssets
      }
    });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.put("/campaigns/:campaignId/live-scene", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const body = request.body as Record<string, unknown>;
    const preset = assertString(body.preset, "preset");
    const title = assertString(body.title, "title");
    const text = optionalString(body.text) ?? "";

    await requireGmCampaign(request.params.campaignId, auth.user.id);

    const campaign = await prisma.campaign.update({
      where: { id: request.params.campaignId },
      data: {
        scenePreset: preset,
        sceneTitle: title,
        sceneText: text
      }
    });

    response.json({
      scene: {
        preset: campaign.scenePreset,
        title: campaign.sceneTitle,
        text: campaign.sceneText
      }
    });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/campaigns/:campaignId/scene-elements", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const body = request.body as Record<string, unknown>;
    const type = assertString(body.type, "type");
    const name = assertString(body.name, "name");
    const description = optionalString(body.description) ?? "";
    const quantity = Number(body.quantity ?? 1);
    const assetId = optionalString(body.assetId);

    if (!Object.values(SceneElementType).includes(type as SceneElementType)) {
      throw new HttpError(400, "Type d'evenement invalide");
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new HttpError(400, "La quantite doit etre comprise entre 1 et 20");
    }

    await requireGmCampaign(request.params.campaignId, auth.user.id);

    if (assetId) {
      const asset = await prisma.revelationAsset.findUnique({ where: { id: assetId } });

      if (!asset || asset.type !== type) {
        throw new HttpError(400, "Cette image ne correspond pas au type de revelation");
      }
    }

    const element = await prisma.sceneElement.create({
      data: {
        campaignId: request.params.campaignId,
        type: type as SceneElementType,
        name,
        description,
        quantity,
        assetId
      }
    });

    response.status(201).json({ element });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.patch("/campaigns/:campaignId/scene-elements/:elementId", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const body = request.body as Record<string, unknown>;

    await requireGmCampaign(request.params.campaignId, auth.user.id);

    if (typeof body.isVisible !== "boolean") {
      throw new HttpError(400, "isVisible doit etre un booleen");
    }

    const existing = await prisma.sceneElement.findFirst({
      where: {
        id: request.params.elementId,
        campaignId: request.params.campaignId
      }
    });

    if (!existing) {
      throw new HttpError(404, "Element de scene introuvable");
    }

    const element = await prisma.sceneElement.update({
      where: { id: existing.id },
      data: { isVisible: body.isVisible }
    });

    response.json({ element });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.delete("/campaigns/:campaignId/scene-elements/:elementId", async (request, response, next) => {
  try {
    const auth = requireAuth(request);

    await requireGmCampaign(request.params.campaignId, auth.user.id);

    const existing = await prisma.sceneElement.findFirst({
      where: {
        id: request.params.elementId,
        campaignId: request.params.campaignId
      }
    });

    if (!existing) {
      throw new HttpError(404, "Element de scene introuvable");
    }

    await prisma.sceneElement.delete({ where: { id: existing.id } });

    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

campaignsRouter.get("/campaigns/:campaignId/stream", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const member = await prisma.campaignMember.findUnique({
      where: { campaignId_userId: { campaignId: request.params.campaignId, userId: auth.user.id } }
    });
    if (!member) throw new HttpError(403, "Tu ne participes pas a cette partie");

    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();

    sseSubscribe(request.params.campaignId, response);
    request.on("close", () => sseUnsubscribe(request.params.campaignId, response));
  } catch (error) {
    next(error);
  }
});

campaignsRouter.patch("/campaigns/:campaignId/scene-elements/:elementId/position", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const body = request.body as Record<string, unknown>;
    const posX = Number(body.posX);
    const posY = Number(body.posY);

    if (!Number.isFinite(posX) || !Number.isFinite(posY)) {
      throw new HttpError(400, "Position invalide");
    }

    await requireGmCampaign(request.params.campaignId, auth.user.id);

    const element = await prisma.sceneElement.findFirst({
      where: { id: request.params.elementId, campaignId: request.params.campaignId }
    });
    if (!element) throw new HttpError(404, "Element de scene introuvable");

    const clamped = {
      posX: Math.max(2, Math.min(98, posX)),
      posY: Math.max(2, Math.min(98, posY))
    };

    await prisma.sceneElement.update({
      where: { id: element.id },
      data: clamped
    });

    sseBroadcast(request.params.campaignId, {
      type: "element:moved",
      elementId: element.id,
      posX: clamped.posX,
      posY: clamped.posY
    });

    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/campaigns/:campaignId/ready", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const member = await prisma.campaignMember.findUnique({
      where: {
        campaignId_userId: {
          campaignId: request.params.campaignId,
          userId: auth.user.id
        }
      }
    });

    if (!member) throw new HttpError(403, "Tu ne participes pas a cette partie");
    if (member.role === "GM") throw new HttpError(400, "Le MJ n'a pas besoin de se marquer pret");

    const updated = await prisma.campaignMember.update({
      where: { id: member.id },
      data: { isReady: !member.isReady }
    });

    response.json({ isReady: updated.isReady });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/campaigns/:campaignId/launch", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const campaign = await prisma.campaign.findUnique({
      where: { id: request.params.campaignId },
      include: { members: true }
    });

    if (!campaign) {
      throw new HttpError(404, "Partie introuvable");
    }

    if (campaign.gmUserId !== auth.user.id) {
      throw new HttpError(403, "Seul le MJ peut lancer la campagne");
    }

    if (campaign.status !== "DRAFT") {
      throw new HttpError(400, "La campagne est deja lancee ou terminee");
    }

    const players = campaign.members.filter((m) => m.role === "PLAYER");
    const allReady = players.length > 0 && players.every((m) => m.isReady);
    if (!allReady) {
      throw new HttpError(400, "Tous les joueurs doivent etre prets avant de lancer");
    }

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: "ACTIVE",
        startedAt: new Date()
      }
    });

    response.json({ campaign: serializeCampaign(updated) });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/campaigns/:campaignId/stop", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const campaign = await prisma.campaign.findUnique({
      where: { id: request.params.campaignId }
    });

    if (!campaign) {
      throw new HttpError(404, "Partie introuvable");
    }

    if (campaign.gmUserId !== auth.user.id) {
      throw new HttpError(403, "Seul le MJ peut stopper la campagne");
    }

    if (campaign.status !== "ACTIVE") {
      throw new HttpError(400, "La campagne n'est pas en cours");
    }

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: "CLOSED",
        endedAt: new Date()
      }
    });

    response.json({ campaign: serializeCampaign(updated) });
  } catch (error) {
    next(error);
  }
});

// GET /campaigns/:campaignId/notes — récupère les notes privées du joueur connecté
campaignsRouter.get("/campaigns/:campaignId/notes", async (request, response, next) => {
  try {
    const auth = requireAuth(request);

    const member = await prisma.campaignMember.findUnique({
      where: {
        campaignId_userId: {
          campaignId: request.params.campaignId,
          userId: auth.user.id
        }
      }
    });

    if (!member) {
      throw new HttpError(403, "Tu ne participes pas a cette partie");
    }

    const note = await prisma.playerNote.findUnique({
      where: {
        userId_campaignId: {
          userId: auth.user.id,
          campaignId: request.params.campaignId
        }
      }
    });

    response.json({ content: note?.content ?? "" });
  } catch (error) {
    next(error);
  }
});

// PUT /campaigns/:campaignId/notes — sauvegarde les notes privées du joueur connecté
campaignsRouter.put("/campaigns/:campaignId/notes", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const body = request.body as Record<string, unknown>;
    const content = optionalString(body.content) ?? "";

    const member = await prisma.campaignMember.findUnique({
      where: {
        campaignId_userId: {
          campaignId: request.params.campaignId,
          userId: auth.user.id
        }
      }
    });

    if (!member) {
      throw new HttpError(403, "Tu ne participes pas a cette partie");
    }

    const note = await prisma.playerNote.upsert({
      where: {
        userId_campaignId: {
          userId: auth.user.id,
          campaignId: request.params.campaignId
        }
      },
      update: { content },
      create: {
        userId: auth.user.id,
        campaignId: request.params.campaignId,
        content
      }
    });

    response.json({ content: note.content });
  } catch (error) {
    next(error);
  }
});

// POST /campaigns/:campaignId/character — crée la fiche avec les stats de base
campaignsRouter.post("/campaigns/:campaignId/character", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const body = request.body as Record<string, unknown>;
    const charId   = Number(body.charId);
    const charName = assertString(body.charName, "charName");

    const member = await prisma.campaignMember.findUnique({
      where: { campaignId_userId: { campaignId: request.params.campaignId, userId: auth.user.id } }
    });
    if (!member) throw new HttpError(403, "Tu ne participes pas a cette partie");

    const stats = getBaseStats(charId);

    const sheet = await prisma.characterSheet.upsert({
      where: { userId_campaignId: { userId: auth.user.id, campaignId: request.params.campaignId } },
      update: { charId, charName, ...stats },
      create: { userId: auth.user.id, campaignId: request.params.campaignId, charId, charName, ...stats }
    });

    response.status(201).json({ sheet });
  } catch (error) {
    next(error);
  }
});

// GET /campaigns/:campaignId/character — récupère la fiche du joueur connecté
campaignsRouter.get("/campaigns/:campaignId/character", async (request, response, next) => {
  try {
    const auth = requireAuth(request);

    const member = await prisma.campaignMember.findUnique({
      where: { campaignId_userId: { campaignId: request.params.campaignId, userId: auth.user.id } }
    });
    if (!member) throw new HttpError(403, "Tu ne participes pas a cette partie");

    const sheet = await prisma.characterSheet.findUnique({
      where: { userId_campaignId: { userId: auth.user.id, campaignId: request.params.campaignId } }
    });
    if (!sheet) throw new HttpError(404, "Fiche personnage introuvable");

    response.json({ sheet });
  } catch (error) {
    next(error);
  }
});
