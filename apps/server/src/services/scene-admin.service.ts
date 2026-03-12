import { SceneStatus } from "@prisma/client";

import { requireCampaignGm } from "../lib/campaign-view.js";
import { assertString, HttpError, optionalNumber } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

const SCENE_STATUSES = ["PREPARED", "LIVE", "ARCHIVED"] as const;

type SceneStatusValue = (typeof SCENE_STATUSES)[number];

function hasOwn(body: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function parseNullableText(value: unknown, fieldName: string) {
  if (value === null || value === "") {
    return null;
  }

  return assertString(value, fieldName);
}

function parseSceneStatus(value: unknown): SceneStatusValue {
  const status = assertString(value, "status").toUpperCase() as SceneStatusValue;

  if (!SCENE_STATUSES.includes(status)) {
    throw new HttpError(400, "Statut de scene invalide");
  }

  return status;
}

export async function updateScene(sceneId: string, userId: string, body: Record<string, unknown>) {
  const scene = await prisma.scene.findUnique({
    where: {
      id: sceneId
    }
  });

  if (!scene) {
    throw new HttpError(404, "Scene introuvable");
  }

  await requireCampaignGm(scene.campaignId, userId);

  const hasTitle = hasOwn(body, "title");
  const hasSummary = hasOwn(body, "summary");
  const hasPlayerText = hasOwn(body, "playerText");
  const hasGmNotes = hasOwn(body, "gmNotes");
  const hasDisplayOrder = hasOwn(body, "displayOrder");
  const hasStatus = hasOwn(body, "status");

  if (!hasTitle && !hasSummary && !hasPlayerText && !hasGmNotes && !hasDisplayOrder && !hasStatus) {
    throw new HttpError(400, "Aucune modification fournie");
  }

  const title = hasTitle ? assertString(body.title, "title") : undefined;
  const summary = hasSummary ? parseNullableText(body.summary, "summary") : undefined;
  const playerText = hasPlayerText ? parseNullableText(body.playerText, "playerText") : undefined;
  const gmNotes = hasGmNotes ? parseNullableText(body.gmNotes, "gmNotes") : undefined;
  const status = hasStatus ? parseSceneStatus(body.status) : undefined;

  let displayOrder: number | undefined;

  if (hasDisplayOrder) {
    const parsedDisplayOrder = optionalNumber(body.displayOrder);

    if (parsedDisplayOrder === undefined || !Number.isInteger(parsedDisplayOrder) || parsedDisplayOrder < 0) {
      throw new HttpError(400, "Champ invalide: displayOrder");
    }

    displayOrder = parsedDisplayOrder;
  }

  const updated = await prisma.scene.update({
    where: {
      id: scene.id
    },
    data: {
      ...(hasTitle ? { title } : {}),
      ...(hasSummary ? { summary } : {}),
      ...(hasPlayerText ? { playerText } : {}),
      ...(hasGmNotes ? { gmNotes } : {}),
      ...(hasDisplayOrder ? { displayOrder } : {}),
      ...(hasStatus ? { status: status as SceneStatus } : {})
    }
  });

  return { scene: updated, campaignId: scene.campaignId };
}

export async function deleteScene(sceneId: string, userId: string, mode: "soft" | "hard") {
  const scene = await prisma.scene.findUnique({
    where: {
      id: sceneId
    }
  });

  if (!scene) {
    throw new HttpError(404, "Scene introuvable");
  }

  await requireCampaignGm(scene.campaignId, userId);

  if (mode === "hard") {
    await prisma.scene.delete({
      where: {
        id: scene.id
      }
    });

    const campaign = await prisma.campaign.findUnique({
      where: { id: scene.campaignId },
      select: { publishedSceneId: true }
    });

    if (campaign?.publishedSceneId === scene.id) {
      await prisma.campaign.update({
        where: { id: scene.campaignId },
        data: {
          publishedSceneId: null,
          publishedVisualId: null,
          publishedAt: null
        }
      });
    }

    return {
      deleted: true,
      mode,
      sceneId: scene.id,
      campaignId: scene.campaignId
    };
  }

  const archived = await prisma.$transaction(async (transaction) => {
    const updatedScene = await transaction.scene.update({
      where: {
        id: scene.id
      },
      data: {
        status: SceneStatus.ARCHIVED
      }
    });

    const campaign = await transaction.campaign.findUnique({
      where: {
        id: scene.campaignId
      },
      select: {
        publishedSceneId: true
      }
    });

    if (campaign?.publishedSceneId === scene.id) {
      await transaction.campaign.update({
        where: {
          id: scene.campaignId
        },
        data: {
          publishedSceneId: null,
          publishedVisualId: null,
          publishedAt: null
        }
      });
    }

    return updatedScene;
  });

  return {
    deleted: false,
    mode,
    scene: archived,
    campaignId: scene.campaignId
  };
}
