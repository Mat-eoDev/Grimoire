import { RewardType } from "@prisma/client";

import { requireCampaignGm } from "../lib/campaign-view.js";
import { assertString, HttpError, optionalNumber } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

const REWARD_TYPES = ["XP", "ITEM", "GOLD", "STORY", "CUSTOM"] as const;

type RewardTypeValue = (typeof REWARD_TYPES)[number];

function hasOwn(body: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function parseNullableText(value: unknown, fieldName: string) {
  if (value === null || value === "") {
    return null;
  }

  return assertString(value, fieldName);
}

function parseRewardType(value: unknown): RewardTypeValue {
  const rewardType = assertString(value, "rewardType").toUpperCase() as RewardTypeValue;

  if (!REWARD_TYPES.includes(rewardType)) {
    throw new HttpError(400, "Type de recompense invalide");
  }

  return rewardType;
}

export async function updateReward(rewardId: string, userId: string, body: Record<string, unknown>) {
  const reward = await prisma.reward.findUnique({
    where: {
      id: rewardId
    }
  });

  if (!reward) {
    throw new HttpError(404, "Recompense introuvable");
  }

  await requireCampaignGm(reward.campaignId, userId);

  const hasRewardType = hasOwn(body, "rewardType");
  const hasLabel = hasOwn(body, "label");
  const hasDescription = hasOwn(body, "description");
  const hasNumericValue = hasOwn(body, "numericValue");

  if (!hasRewardType && !hasLabel && !hasDescription && !hasNumericValue) {
    throw new HttpError(400, "Aucune modification fournie");
  }

  const rewardType = hasRewardType ? parseRewardType(body.rewardType) : undefined;
  const label = hasLabel ? assertString(body.label, "label") : undefined;
  const description = hasDescription ? parseNullableText(body.description, "description") : undefined;
  const numericValue = hasNumericValue
    ? body.numericValue === null || body.numericValue === ""
      ? null
      : optionalNumber(body.numericValue)
    : undefined;

  const updated = await prisma.reward.update({
    where: {
      id: reward.id
    },
    data: {
      ...(hasRewardType ? { rewardType: rewardType as RewardType } : {}),
      ...(hasLabel ? { label } : {}),
      ...(hasDescription ? { description } : {}),
      ...(hasNumericValue ? { numericValue } : {})
    }
  });

  return { reward: updated, campaignId: reward.campaignId };
}

export async function deleteRewardAssignment(assignmentId: string, userId: string) {
  const assignment = await prisma.rewardAssignment.findUnique({
    where: {
      id: assignmentId
    }
  });

  if (!assignment) {
    throw new HttpError(404, "Attribution de recompense introuvable");
  }

  await requireCampaignGm(assignment.campaignId, userId);

  await prisma.rewardAssignment.delete({
    where: {
      id: assignment.id
    }
  });

  return {
    assignmentId: assignment.id,
    rewardId: assignment.rewardId,
    campaignId: assignment.campaignId,
    deleted: true
  };
}
