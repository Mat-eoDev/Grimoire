import { randomUUID } from "node:crypto";

import { ActorType, MemberRole, MemberStatus } from "@prisma/client";
import { Router } from "express";

import { buildCampaignPayload, getCampaignMembership, requireCampaignGm } from "../lib/campaign-view.js";
import { assertString, HttpError, optionalNumber, optionalString } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { campaignEventHub } from "../lib/sse.js";
import { requireAuth } from "../middleware/auth.js";
import {
  deleteActor,
  deleteCampaign,
  updateActor,
  updateCampaign,
  updateCampaignMember,
  updateCharacter
} from "../services/campaign-admin.service.js";

export const campaignsRouter = Router();

campaignsRouter.post("/campaigns", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const body = request.body as Record<string, unknown>;
    const title = assertString(body.title, "title");
    const description = optionalString(body.description);

    const campaign = await prisma.campaign.create({
      data: {
        gmUserId: auth.user.id,
        title,
        description,
        status: "ACTIVE",
        members: {
          create: {
            userId: auth.user.id,
            role: MemberRole.GM,
            status: MemberStatus.ACTIVE,
            joinedAt: new Date()
          }
        }
      }
    });

    response.status(201).json({ campaign });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.get("/campaigns/:campaignId", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const payload = await buildCampaignPayload(request.params.campaignId, auth.user.id);
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

campaignsRouter.get("/campaigns/:campaignId/events", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await getCampaignMembership(request.params.campaignId, auth.user.id);

    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();

    campaignEventHub.subscribe(request.params.campaignId, response);
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/campaigns/:campaignId/invites", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireCampaignGm(request.params.campaignId, auth.user.id);
    const body = request.body as Record<string, unknown>;
    const targetEmail = assertString(body.targetEmail, "targetEmail").toLowerCase();

    const invite = await prisma.campaignInvite.create({
      data: {
        campaignId: request.params.campaignId,
        invitedByUserId: auth.user.id,
        targetEmail,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
      }
    });

    response.status(201).json({
      invite,
      joinUrl: `http://localhost:5173/invite/${invite.token}`
    });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/invites/:token/accept", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const invite = await prisma.campaignInvite.findUnique({
      where: {
        token: request.params.token
      }
    });

    if (!invite) {
      throw new HttpError(404, "Invitation introuvable");
    }

    if (invite.status !== "PENDING" || invite.expiresAt < new Date()) {
      throw new HttpError(400, "Invitation invalide ou expiree");
    }

    if (invite.targetEmail.toLowerCase() !== auth.user.email.toLowerCase()) {
      throw new HttpError(403, "Cette invitation ne correspond pas a ton compte");
    }

    const member = await prisma.campaignMember.upsert({
      where: {
        campaignId_userId: {
          campaignId: invite.campaignId,
          userId: auth.user.id
        }
      },
      update: {
        role: MemberRole.PLAYER,
        status: MemberStatus.ACTIVE,
        joinedAt: new Date()
      },
      create: {
        campaignId: invite.campaignId,
        userId: auth.user.id,
        role: MemberRole.PLAYER,
        status: MemberStatus.ACTIVE,
        joinedAt: new Date()
      }
    });

    await prisma.campaignInvite.update({
      where: {
        id: invite.id
      },
      data: {
        status: "ACCEPTED",
        acceptedByUserId: auth.user.id
      }
    });

    campaignEventHub.publish(invite.campaignId, "player_status.updated", {
      memberId: member.id
    });

    response.json({ member });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/campaigns/:campaignId/characters", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const membership = await getCampaignMembership(request.params.campaignId, auth.user.id);

    if (membership.role !== MemberRole.PLAYER || membership.status !== MemberStatus.ACTIVE) {
      throw new HttpError(403, "Seul un joueur actif peut creer un personnage");
    }

    const body = request.body as Record<string, unknown>;
    const name = assertString(body.name, "name");
    const raceId = optionalNumber(body.raceId);
    const classId = optionalNumber(body.classId);
    const level = optionalNumber(body.level) ?? 1;
    const hpMax = optionalNumber(body.hpMax) ?? 10;
    const mjNotes = optionalString(body.mjNotes);

    const actor = await prisma.gameActor.create({
      data: {
        campaignId: request.params.campaignId,
        ownerMemberId: membership.id,
        actorType: ActorType.PLAYER_CHARACTER,
        name,
        raceId,
        classId,
        level,
        hpMax,
        hpCurrent: hpMax,
        mjNotes,
        isApproved: false
      }
    });

    campaignEventHub.publish(request.params.campaignId, "player_status.updated", {
      actorId: actor.id
    });

    response.status(201).json({ actor });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/campaigns/:campaignId/actors", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireCampaignGm(request.params.campaignId, auth.user.id);
    const body = request.body as Record<string, unknown>;
    const templateId = optionalString(body.templateId);
    const actorTypeValue = optionalString(body.actorType) ?? ActorType.NPC;
    const actorType = actorTypeValue as ActorType;

    if (actorType === ActorType.PLAYER_CHARACTER) {
      throw new HttpError(400, "Utilise la route de personnage joueur pour ce type");
    }

    let defaults: {
      name: string;
      actorType: ActorType;
      level: number;
      hpMax: number;
      summary?: string | null;
    } | null = null;

    if (templateId) {
      const template = await prisma.actorTemplate.findUnique({
        where: { id: templateId }
      });

      if (!template) {
        throw new HttpError(404, "Modele de PNJ/monstre introuvable");
      }

      defaults = template;
    }

    const name = optionalString(body.name) ?? defaults?.name;

    if (!name) {
      throw new HttpError(400, "Le nom de l'acteur est obligatoire");
    }

    const level = optionalNumber(body.level) ?? defaults?.level ?? 1;
    const hpMax = optionalNumber(body.hpMax) ?? defaults?.hpMax ?? 10;
    const actor = await prisma.gameActor.create({
      data: {
        campaignId: request.params.campaignId,
        actorType: defaults?.actorType ?? actorType,
        name,
        level,
        hpMax,
        hpCurrent: hpMax,
        mjNotes: optionalString(body.mjNotes) ?? defaults?.summary ?? undefined,
        isApproved: true
      }
    });

    response.status(201).json({ actor });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/characters/:characterId/validate", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const body = request.body as Record<string, unknown>;
    const approved = body.approved === false ? false : true;

    const character = await prisma.gameActor.findUnique({
      where: {
        id: request.params.characterId
      }
    });

    if (!character || character.actorType !== ActorType.PLAYER_CHARACTER) {
      throw new HttpError(404, "Personnage introuvable");
    }

    await requireCampaignGm(character.campaignId, auth.user.id);

    const updated = await prisma.gameActor.update({
      where: {
        id: character.id
      },
      data: {
        isApproved: approved
      }
    });

    campaignEventHub.publish(character.campaignId, "player_status.updated", {
      actorId: updated.id,
      approved
    });

    response.json({ actor: updated });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.patch("/campaigns/:campaignId", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const result = await updateCampaign(request.params.campaignId, auth.user.id, request.body as Record<string, unknown>);

    campaignEventHub.publish(request.params.campaignId, "player_status.updated", {
      campaignId: request.params.campaignId
    });

    response.json(result);
  } catch (error) {
    next(error);
  }
});

campaignsRouter.patch("/campaigns/:campaignId/members/:memberId", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const result = await updateCampaignMember(
      request.params.campaignId,
      request.params.memberId,
      auth.user.id,
      request.body as Record<string, unknown>
    );

    campaignEventHub.publish(request.params.campaignId, "player_status.updated", {
      memberId: request.params.memberId
    });

    response.json(result);
  } catch (error) {
    next(error);
  }
});

campaignsRouter.delete("/campaigns/:campaignId", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const mode = request.query.mode === "hard" ? "hard" : "soft";
    const result = await deleteCampaign(request.params.campaignId, auth.user.id, mode);

    campaignEventHub.publish(request.params.campaignId, "player_status.updated", {
      campaignId: request.params.campaignId,
      deleted: mode === "hard"
    });

    response.json(result);
  } catch (error) {
    next(error);
  }
});

campaignsRouter.patch("/actors/:actorId", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const result = await updateActor(request.params.actorId, auth.user.id, request.body as Record<string, unknown>);

    campaignEventHub.publish(result.actor.campaignId, "player_status.updated", {
      actorId: result.actor.id
    });

    response.json(result);
  } catch (error) {
    next(error);
  }
});

campaignsRouter.delete("/actors/:actorId", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const result = await deleteActor(request.params.actorId, auth.user.id);

    campaignEventHub.publish(result.actor.campaignId, "player_status.updated", {
      actorId: result.actor.id,
      removed: true
    });

    response.json(result);
  } catch (error) {
    next(error);
  }
});

campaignsRouter.patch("/characters/:characterId", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const result = await updateCharacter(
      request.params.characterId,
      auth.user.id,
      request.body as Record<string, unknown>
    );

    campaignEventHub.publish(result.actor.campaignId, "player_status.updated", {
      actorId: result.actor.id
    });

    response.json(result);
  } catch (error) {
    next(error);
  }
});