import { ActorType, CombatActionType, CombatSide } from "@prisma/client";
import { Router } from "express";

import { requireCampaignGm } from "../lib/campaign-view.js";
import { assertString, HttpError, optionalNumber, optionalString, requireArray } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { campaignEventHub } from "../lib/sse.js";
import { requireAuth } from "../middleware/auth.js";

export const combatsRouter = Router();

function computeParticipantStatus(nextHp: number) {
  if (nextHp <= 0) {
    return "KO" as const;
  }

  return "ACTIVE" as const;
}

combatsRouter.post("/combats", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const body = request.body as Record<string, unknown>;
    const campaignId = assertString(body.campaignId, "campaignId");
    const sceneId = typeof body.sceneId === "string" && body.sceneId ? body.sceneId : undefined;
    const participantActorIds = requireArray(body.participantActorIds, "participantActorIds").map((value) =>
      String(value)
    );

    if (participantActorIds.length < 2) {
      throw new HttpError(400, "Un combat doit contenir au moins 2 participants");
    }

    await requireCampaignGm(campaignId, auth.user.id);

    const activeCombat = await prisma.combat.findFirst({
      where: {
        campaignId,
        status: {
          in: ["LIVE", "PAUSED"]
        }
      }
    });

    if (activeCombat) {
      throw new HttpError(409, "Un combat est deja actif pour cette campagne");
    }

    const actors = await prisma.gameActor.findMany({
      where: {
        campaignId,
        id: {
          in: participantActorIds
        }
      }
    });

    if (actors.length !== participantActorIds.length) {
      throw new HttpError(400, "Tous les participants doivent appartenir a la campagne");
    }

    const combat = await prisma.combat.create({
      data: {
        campaignId,
        sceneId,
        initiatedByUserId: auth.user.id,
        status: "LIVE",
        mjValidated: true,
        startedAt: new Date(),
        participants: {
          create: actors.map((actor) => ({
            actorId: actor.id,
            side: actor.actorType === ActorType.PLAYER_CHARACTER ? CombatSide.PLAYERS : CombatSide.OPPONENTS,
            currentHp: actor.hpCurrent > 0 ? actor.hpCurrent : actor.hpMax,
            status: "ACTIVE"
          }))
        }
      },
      include: {
        participants: true
      }
    });

    campaignEventHub.publish(campaignId, "combat.updated", {
      combatId: combat.id
    });

    response.status(201).json({ combat });
  } catch (error) {
    next(error);
  }
});

combatsRouter.post("/combats/:combatId/actions", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const combat = await prisma.combat.findUnique({
      where: {
        id: request.params.combatId
      }
    });

    if (!combat) {
      throw new HttpError(404, "Combat introuvable");
    }

    await requireCampaignGm(combat.campaignId, auth.user.id);

    const body = request.body as Record<string, unknown>;
    const sourceParticipantId = assertString(body.sourceParticipantId, "sourceParticipantId");
    const targetParticipantId = optionalString(body.targetParticipantId);
    const actionType = assertString(body.actionType, "actionType") as CombatActionType;
    const actionLabel = assertString(body.actionLabel, "actionLabel");
    const damageValue = optionalNumber(body.damageValue);
    const healingValue = optionalNumber(body.healingValue);
    const resultText = optionalString(body.resultText);

    const sourceParticipant = await prisma.combatParticipant.findFirst({
      where: {
        id: sourceParticipantId,
        combatId: combat.id
      }
    });

    if (!sourceParticipant) {
      throw new HttpError(404, "Participant source introuvable");
    }

    const targetParticipant = targetParticipantId
      ? await prisma.combatParticipant.findFirst({
          where: {
            id: targetParticipantId,
            combatId: combat.id
          },
          include: {
            actor: true
          }
        })
      : null;

    const action = await prisma.$transaction(async (transaction) => {
      if (targetParticipant) {
        const delta = (healingValue ?? 0) - (damageValue ?? 0);
        const nextHp = Math.max(0, Math.min(targetParticipant.actor.hpMax, targetParticipant.currentHp + delta));
        const nextStatus = computeParticipantStatus(nextHp);

        await transaction.combatParticipant.update({
          where: {
            id: targetParticipant.id
          },
          data: {
            currentHp: nextHp,
            status: nextStatus
          }
        });

        await transaction.gameActor.update({
          where: {
            id: targetParticipant.actorId
          },
          data: {
            hpCurrent: nextHp
          }
        });
      }

      return transaction.combatAction.create({
        data: {
          combatId: combat.id,
          sourceParticipantId,
          targetParticipantId,
          actionType,
          actionLabel,
          damageValue,
          healingValue,
          resultText,
          validatedByUserId: auth.user.id
        }
      });
    });

    campaignEventHub.publish(combat.campaignId, "combat.updated", {
      combatId: combat.id,
      actionId: action.id
    });
    campaignEventHub.publish(combat.campaignId, "player_status.updated", {
      combatId: combat.id
    });

    response.status(201).json({ action });
  } catch (error) {
    next(error);
  }
});

combatsRouter.post("/combats/:combatId/end", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const combat = await prisma.combat.findUnique({
      where: {
        id: request.params.combatId
      }
    });

    if (!combat) {
      throw new HttpError(404, "Combat introuvable");
    }

    await requireCampaignGm(combat.campaignId, auth.user.id);

    const updated = await prisma.combat.update({
      where: {
        id: combat.id
      },
      data: {
        status: "ENDED",
        mjValidated: true,
        endedAt: new Date()
      }
    });

    campaignEventHub.publish(combat.campaignId, "combat.updated", {
      combatId: updated.id,
      status: updated.status
    });

    response.json({ combat: updated });
  } catch (error) {
    next(error);
  }
});
