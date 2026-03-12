import { RewardType } from "@prisma/client";
import { Router } from "express";

import { requireCampaignGm } from "../lib/campaign-view.js";
import { assertString, HttpError, optionalNumber, optionalString } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { campaignEventHub } from "../lib/sse.js";
import { requireAuth } from "../middleware/auth.js";
import { deleteRewardAssignment, updateReward } from "../services/reward-admin.service.js";

export const rewardsRouter = Router();

rewardsRouter.post("/campaigns/:campaignId/rewards", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireCampaignGm(request.params.campaignId, auth.user.id);
    const body = request.body as Record<string, unknown>;

    const reward = await prisma.reward.create({
      data: {
        campaignId: request.params.campaignId,
        createdByUserId: auth.user.id,
        rewardType: assertString(body.rewardType, "rewardType") as RewardType,
        label: assertString(body.label, "label"),
        description: optionalString(body.description),
        numericValue: optionalNumber(body.numericValue)
      }
    });

    response.status(201).json({ reward });
  } catch (error) {
    next(error);
  }
});

rewardsRouter.patch("/rewards/:rewardId", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const result = await updateReward(request.params.rewardId, auth.user.id, request.body as Record<string, unknown>);

    campaignEventHub.publish(result.campaignId, "reward.assigned", {
      rewardId: result.reward.id,
      updated: true
    });

    response.json({ reward: result.reward });
  } catch (error) {
    next(error);
  }
});

rewardsRouter.post("/rewards/:rewardId/assign", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const reward = await prisma.reward.findUnique({
      where: {
        id: request.params.rewardId
      }
    });

    if (!reward) {
      throw new HttpError(404, "Recompense introuvable");
    }

    await requireCampaignGm(reward.campaignId, auth.user.id);

    const body = request.body as Record<string, unknown>;
    const actorId = optionalString(body.actorId);
    const quantity = optionalNumber(body.quantity) ?? 1;

    if (actorId) {
      const actor = await prisma.gameActor.findFirst({
        where: {
          id: actorId,
          campaignId: reward.campaignId
        }
      });

      if (!actor) {
        throw new HttpError(404, "Acteur introuvable pour cette campagne");
      }
    }

    const assignment = await prisma.rewardAssignment.create({
      data: {
        rewardId: reward.id,
        campaignId: reward.campaignId,
        actorId,
        grantedByUserId: auth.user.id,
        combatId: optionalString(body.combatId),
        sceneId: optionalString(body.sceneId),
        quantity
      }
    });

    campaignEventHub.publish(reward.campaignId, "reward.assigned", {
      rewardId: reward.id,
      assignmentId: assignment.id
    });

    response.status(201).json({ assignment });
  } catch (error) {
    next(error);
  }
});

rewardsRouter.delete("/reward-assignments/:assignmentId", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const result = await deleteRewardAssignment(request.params.assignmentId, auth.user.id);

    campaignEventHub.publish(result.campaignId, "reward.assigned", {
      rewardId: result.rewardId,
      assignmentId: result.assignmentId,
      deleted: true
    });

    response.json(result);
  } catch (error) {
    next(error);
  }
});
