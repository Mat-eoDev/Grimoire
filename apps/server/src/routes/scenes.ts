import { MemberStatus } from "@prisma/client";
import { Router } from "express";

import { requireCampaignGm } from "../lib/campaign-view.js";
import { assertString, HttpError, optionalNumber, optionalString } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { campaignEventHub } from "../lib/sse.js";
import { requireAuth } from "../middleware/auth.js";
import { deleteScene, updateScene } from "../services/scene-admin.service.js";

export const scenesRouter = Router();

scenesRouter.post("/campaigns/:campaignId/scenes", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireCampaignGm(request.params.campaignId, auth.user.id);
    const body = request.body as Record<string, unknown>;
    const title = assertString(body.title, "title");
    const actorIds = (Array.isArray(body.actorIds) ? body.actorIds : []) as string[];

    const created = await prisma.$transaction(async (transaction) => {
      const scene = await transaction.scene.create({
        data: {
          campaignId: request.params.campaignId,
          title,
          summary: optionalString(body.summary),
          playerText: optionalString(body.playerText),
          gmNotes: optionalString(body.gmNotes),
          displayOrder: optionalNumber(body.displayOrder) ?? 0
        }
      });

      const visualLabel = optionalString(body.visualLabel);
      const visualUrl = optionalString(body.visualUrl);
      let visual = null;

      if (visualLabel && visualUrl) {
        visual = await transaction.sceneVisual.create({
          data: {
            sceneId: scene.id,
            label: visualLabel,
            assetUrl: visualUrl,
            mediaType: "BACKGROUND"
          }
        });
      }

      if (actorIds.length > 0) {
        const actors = await transaction.gameActor.findMany({
          where: {
            id: {
              in: actorIds
            },
            campaignId: request.params.campaignId
          },
          select: { id: true }
        });

        await transaction.sceneActor.createMany({
          data: actors.map((actor) => ({
            sceneId: scene.id,
            actorId: actor.id,
            visibilityScope: "ALL_PLAYERS"
          })),
          skipDuplicates: true
        });
      }

      return {
        scene,
        visual
      };
    });

    response.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

scenesRouter.post("/scenes/:sceneId/actors", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const scene = await prisma.scene.findUnique({
      where: {
        id: request.params.sceneId
      }
    });

    if (!scene) {
      throw new HttpError(404, "Scene introuvable");
    }

    await requireCampaignGm(scene.campaignId, auth.user.id);

    const body = request.body as Record<string, unknown>;
    const actorId = assertString(body.actorId, "actorId");
    const actor = await prisma.gameActor.findFirst({
      where: {
        id: actorId,
        campaignId: scene.campaignId
      }
    });

    if (!actor) {
      throw new HttpError(404, "Acteur introuvable pour cette campagne");
    }

    const link = await prisma.sceneActor.upsert({
      where: {
        sceneId_actorId: {
          sceneId: scene.id,
          actorId
        }
      },
      update: {
        narrativeRole: optionalString(body.narrativeRole),
        visibilityScope: optionalString(body.visibilityScope) === "GM_ONLY" ? "GM_ONLY" : "ALL_PLAYERS"
      },
      create: {
        sceneId: scene.id,
        actorId,
        narrativeRole: optionalString(body.narrativeRole),
        visibilityScope: optionalString(body.visibilityScope) === "GM_ONLY" ? "GM_ONLY" : "ALL_PLAYERS"
      }
    });

    response.status(201).json({ link });
  } catch (error) {
    next(error);
  }
});

scenesRouter.post("/scenes/:sceneId/publish", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const scene = await prisma.scene.findUnique({
      where: {
        id: request.params.sceneId
      },
      include: {
        visuals: true
      }
    });

    if (!scene) {
      throw new HttpError(404, "Scene introuvable");
    }

    await requireCampaignGm(scene.campaignId, auth.user.id);

    const body = request.body as Record<string, unknown>;
    const visualId = optionalString(body.visualId) ?? scene.visuals[0]?.id ?? null;
    const requestedMemberIds = Array.isArray(body.memberIds) ? body.memberIds.map((value) => String(value)) : null;

    if (visualId) {
      const found = scene.visuals.some((visual) => visual.id === visualId);
      if (!found) {
        throw new HttpError(400, "Le visuel ne correspond pas a la scene");
      }
    }

    const activePlayers = await prisma.campaignMember.findMany({
      where: {
        campaignId: scene.campaignId,
        role: "PLAYER",
        status: MemberStatus.ACTIVE
      },
      select: {
        id: true
      }
    });

    const targetPlayers = requestedMemberIds
      ? activePlayers.filter((member) => requestedMemberIds.includes(member.id))
      : activePlayers;

    if (requestedMemberIds && targetPlayers.length !== requestedMemberIds.length) {
      throw new HttpError(400, "Un ou plusieurs membres cibles sont invalides ou inactifs");
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.campaign.update({
        where: {
          id: scene.campaignId
        },
        data: {
          publishedSceneId: scene.id,
          publishedVisualId: visualId,
          publishedAt: new Date(),
          status: "ACTIVE"
        }
      });

      await transaction.scene.update({
        where: {
          id: scene.id
        },
        data: {
          status: "LIVE"
        }
      });

      if (visualId) {
        const activePlayerIds = activePlayers.map((member) => member.id);
        const targetPlayerIds = targetPlayers.map((member) => member.id);

        await transaction.visualShare.deleteMany({
          where: {
            visualId,
            memberId: {
              in: activePlayerIds,
              notIn: targetPlayerIds
            }
          }
        });

        await transaction.visualShare.createMany({
          data: targetPlayers.map((member) => ({
            visualId,
            memberId: member.id,
            grantedByUserId: auth.user.id
          })),
          skipDuplicates: true
        });
      }
    });

    campaignEventHub.publish(scene.campaignId, "scene.updated", {
      sceneId: scene.id
    });
    campaignEventHub.publish(scene.campaignId, "display.updated", {
      sceneId: scene.id,
      visualId,
      memberIds: targetPlayers.map((member) => member.id)
    });

    response.json({
      sceneId: scene.id,
      visualId,
      memberIds: targetPlayers.map((member) => member.id)
    });
  } catch (error) {
    next(error);
  }
});

scenesRouter.patch("/scenes/:sceneId", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const result = await updateScene(request.params.sceneId, auth.user.id, request.body as Record<string, unknown>);

    campaignEventHub.publish(result.campaignId, "scene.updated", {
      sceneId: result.scene.id
    });

    response.json({ scene: result.scene });
  } catch (error) {
    next(error);
  }
});

scenesRouter.delete("/scenes/:sceneId", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const mode = request.query.mode === "hard" ? "hard" : "soft";
    const result = await deleteScene(request.params.sceneId, auth.user.id, mode);

    campaignEventHub.publish(result.campaignId, "scene.updated", {
      sceneId: result.sceneId ?? result.scene?.id,
      deleted: result.deleted
    });
    campaignEventHub.publish(result.campaignId, "display.updated", {
      sceneId: result.sceneId ?? result.scene?.id,
      deleted: result.deleted
    });

    response.json(result);
  } catch (error) {
    next(error);
  }
});
