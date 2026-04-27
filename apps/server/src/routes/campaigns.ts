import { randomBytes } from "node:crypto";

import { MemberRole } from "@prisma/client";
import { Router } from "express";

import { assertString, HttpError, optionalString } from "../lib/http.js";
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
        joinedAt: member.joinedAt,
        user: member.user
      }))
    });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/campaigns/:campaignId/launch", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const campaign = await prisma.campaign.findUnique({
      where: { id: request.params.campaignId }
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
