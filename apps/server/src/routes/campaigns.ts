import { randomBytes } from "node:crypto";

import { ActionRollConsequenceType, ActionRollStatus, ActionRollTargetType, MemberRole, SceneElementType } from "@prisma/client";
import { Router } from "express";

import { assertString, HttpError, optionalString } from "../lib/http.js";
import { sseBroadcast, sseSubscribe, sseUnsubscribe } from "../lib/sseHub.js";
import { getBaseStats } from "../lib/characterStats.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

export const campaignsRouter = Router();

// Limite l'enumeration des codes de partie (espace de 32^6 mais devine-able en masse).
const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Trop de tentatives. Reessaie dans quelques minutes."
});

function generateJoinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

function toInteger(value: unknown, fallback: number) {
  const numberValue = Number(value ?? fallback);
  return Number.isFinite(numberValue) ? Math.floor(numberValue) : fallback;
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

function getRollOutcome(roll: {
  result: number | null;
  totalFailureMax: number;
  successMin: number;
  totalSuccessMin: number;
}) {
  if (roll.result === null) return null;
  if (roll.result <= roll.totalFailureMax) return "TOTAL_FAILURE";
  if (roll.result >= roll.totalSuccessMin) return "TOTAL_SUCCESS";
  if (roll.result >= roll.successMin) return "SUCCESS";
  return "FAILURE";
}

type RollOutcome = "TOTAL_FAILURE" | "FAILURE" | "SUCCESS" | "TOTAL_SUCCESS";

type OutcomeConsequence = {
  type: ActionRollConsequenceType;
  amount: number;
  text: string;
};

function readOutcomeConsequence(value: unknown): OutcomeConsequence {
  if (!value || typeof value !== "object") {
    return { type: ActionRollConsequenceType.NONE, amount: 0, text: "" };
  }
  const record = value as Record<string, unknown>;
  const type = typeof record.type === "string" && Object.values(ActionRollConsequenceType).includes(record.type as ActionRollConsequenceType)
    ? record.type as ActionRollConsequenceType
    : ActionRollConsequenceType.NONE;
  return {
    type,
    amount: Math.max(0, toInteger(record.amount, 0)),
    text: optionalString(record.text) ?? ""
  };
}

function getOutcomeConsequences(body: Record<string, unknown>) {
  const source = body.consequences && typeof body.consequences === "object"
    ? body.consequences as Record<string, unknown>
    : {};
  const fallback = {
    type: typeof body.consequenceType === "string" ? body.consequenceType : "NONE",
    amount: body.consequenceAmount,
    text: body.consequenceText
  };

  return {
    TOTAL_FAILURE: readOutcomeConsequence(source.TOTAL_FAILURE),
    FAILURE: readOutcomeConsequence(source.FAILURE),
    SUCCESS: readOutcomeConsequence(source.SUCCESS ?? fallback),
    TOTAL_SUCCESS: readOutcomeConsequence(source.TOTAL_SUCCESS)
  } satisfies Record<RollOutcome, OutcomeConsequence>;
}

function getStoredOutcomeConsequences(roll: {
  consequenceType: ActionRollConsequenceType;
  consequenceAmount: number;
  consequenceText: string;
  totalFailureConsequenceType: ActionRollConsequenceType;
  totalFailureConsequenceAmount: number;
  totalFailureConsequenceText: string;
  failureConsequenceType: ActionRollConsequenceType;
  failureConsequenceAmount: number;
  failureConsequenceText: string;
  successConsequenceType: ActionRollConsequenceType;
  successConsequenceAmount: number;
  successConsequenceText: string;
  totalSuccessConsequenceType: ActionRollConsequenceType;
  totalSuccessConsequenceAmount: number;
  totalSuccessConsequenceText: string;
}) {
  return {
    TOTAL_FAILURE: {
      type: roll.totalFailureConsequenceType,
      amount: roll.totalFailureConsequenceAmount,
      text: roll.totalFailureConsequenceText
    },
    FAILURE: {
      type: roll.failureConsequenceType,
      amount: roll.failureConsequenceAmount,
      text: roll.failureConsequenceText
    },
    SUCCESS: {
      type: roll.successConsequenceType,
      amount: roll.successConsequenceAmount,
      text: roll.successConsequenceText
    },
    TOTAL_SUCCESS: {
      type: roll.totalSuccessConsequenceType,
      amount: roll.totalSuccessConsequenceAmount,
      text: roll.totalSuccessConsequenceText
    }
  } satisfies Record<RollOutcome, OutcomeConsequence>;
}

async function serializeActionRoll(roll: {
  id: string;
  campaignId: string;
  playerUserId: string;
  actionText: string;
  dieSides: number;
  totalFailureMax: number;
  successMin: number;
  totalSuccessMin: number;
  targetType: ActionRollTargetType;
  targetElementId: string | null;
  targetUserId: string | null;
  consequenceType: ActionRollConsequenceType;
  consequenceAmount: number;
  consequenceText: string;
  totalFailureConsequenceType: ActionRollConsequenceType;
  totalFailureConsequenceAmount: number;
  totalFailureConsequenceText: string;
  failureConsequenceType: ActionRollConsequenceType;
  failureConsequenceAmount: number;
  failureConsequenceText: string;
  successConsequenceType: ActionRollConsequenceType;
  successConsequenceAmount: number;
  successConsequenceText: string;
  totalSuccessConsequenceType: ActionRollConsequenceType;
  totalSuccessConsequenceAmount: number;
  totalSuccessConsequenceText: string;
  status: ActionRollStatus;
  result: number | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const [player, targetPlayer, targetElement, rollerSheet, targetSheet] = await Promise.all([
    prisma.user.findUnique({ where: { id: roll.playerUserId }, select: { id: true, username: true } }),
    roll.targetUserId
      ? prisma.user.findUnique({ where: { id: roll.targetUserId }, select: { id: true, username: true } })
      : Promise.resolve(null),
    roll.targetElementId
      ? prisma.sceneElement.findUnique({ where: { id: roll.targetElementId }, select: { id: true, name: true, type: true, hp: true, maxHp: true } })
      : Promise.resolve(null),
    prisma.characterSheet.findUnique({
      where: { userId_campaignId: { userId: roll.playerUserId, campaignId: roll.campaignId } },
      select: { charName: true }
    }),
    roll.targetUserId
      ? prisma.characterSheet.findUnique({
          where: { userId_campaignId: { userId: roll.targetUserId, campaignId: roll.campaignId } },
          select: { charName: true }
        })
      : Promise.resolve(null)
  ]);

  return {
    id: roll.id,
    playerUserId: roll.playerUserId,
    playerUsername: rollerSheet?.charName || player?.username || "Joueur",
    actionText: roll.actionText,
    dieSides: roll.dieSides,
    totalFailureMax: roll.totalFailureMax,
    successMin: roll.successMin,
    totalSuccessMin: roll.totalSuccessMin,
    targetType: roll.targetType,
    targetElementId: roll.targetElementId,
    targetUserId: roll.targetUserId,
    targetName: targetElement?.name ?? targetSheet?.charName ?? targetPlayer?.username ?? "",
    targetElement,
    consequenceType: roll.consequenceType,
    consequenceAmount: roll.consequenceAmount,
    consequenceText: roll.consequenceText,
    consequences: getStoredOutcomeConsequences(roll),
    status: roll.status,
    result: roll.result,
    outcome: getRollOutcome(roll),
    createdAt: roll.createdAt,
    updatedAt: roll.updatedAt
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

async function requireCampaignMember(campaignId: string, userId: string) {
  const member = await prisma.campaignMember.findUnique({
    where: { campaignId_userId: { campaignId, userId } }
  });

  if (!member) {
    throw new HttpError(403, "Tu ne participes pas a cette partie");
  }

  return member;
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

campaignsRouter.post("/campaigns/join", joinLimiter, async (request, response, next) => {
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
    const activeRollsRaw = await prisma.actionRoll.findMany({
      where: {
        campaignId: campaign.id,
        status: { in: [ActionRollStatus.PENDING, ActionRollStatus.ROLLED] },
        OR: viewer.role === MemberRole.GM ? undefined : [{ playerUserId: auth.user.id }]
      },
      orderBy: { createdAt: "desc" }
    });
    const activeRolls = await Promise.all(activeRollsRaw.map(serializeActionRoll));

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
        userId: viewer.userId,
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
            hp: element.hp,
            maxHp: element.maxHp,
            attack: element.attack,
            defense: element.defense,
            posX: element.posX,
            posY: element.posY,
            scale: element.scale,
            asset: element.asset
          })),
        assets: revelationAssets,
        actionRolls: activeRolls
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
    const hp = Math.max(0, toInteger(body.hp, type === "NARRATION" ? 0 : 10));
    const maxHp = Math.max(hp, toInteger(body.maxHp, hp));
    const attack = Math.max(0, toInteger(body.attack, 0));
    const defense = Math.max(0, toInteger(body.defense, 0));

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
        hp,
        maxHp,
        attack,
        defense,
        assetId
      }
    });

    response.status(201).json({ element });
  } catch (error) {
    next(error);
  }
});

// Un element (ennemi / PNJ) attaque un joueur : le MJ inflige des degats a un personnage.
campaignsRouter.post("/campaigns/:campaignId/scene-elements/:elementId/attack", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const body = request.body as Record<string, unknown>;
    const targetUserId = assertString(body.targetUserId, "targetUserId");
    const amount = Math.max(1, toInteger(body.amount, 1));

    await requireGmCampaign(request.params.campaignId, auth.user.id);

    const attacker = await prisma.sceneElement.findFirst({
      where: { id: request.params.elementId, campaignId: request.params.campaignId }
    });
    if (!attacker) {
      throw new HttpError(404, "Element attaquant introuvable");
    }
    if (attacker.type === SceneElementType.NARRATION) {
      throw new HttpError(400, "Un element de narration ne peut pas attaquer");
    }

    const sheet = await prisma.characterSheet.findUnique({
      where: { userId_campaignId: { userId: targetUserId, campaignId: request.params.campaignId } },
      include: { user: { select: { username: true } } }
    });
    if (!sheet) {
      throw new HttpError(404, "Personnage cible introuvable");
    }

    const newHp = Math.max(0, sheet.hp - amount);
    await prisma.characterSheet.update({
      where: { id: sheet.id },
      data: { hp: newHp }
    });

    // Trace visible dans la scene (journal de combat).
    await prisma.sceneElement.create({
      data: {
        campaignId: request.params.campaignId,
        type: SceneElementType.NARRATION,
        name: "Attaque",
        description: `${attacker.name} attaque ${sheet.charName || sheet.user.username} (-${amount} PV)`,
        quantity: 1,
        isVisible: true
      }
    });

    sseBroadcast(request.params.campaignId, { type: "campaign:changed" });

    response.json({ ok: true, targetUserId, hp: newHp });
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

campaignsRouter.patch("/campaigns/:campaignId/scene-elements/:elementId/scale", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const body = request.body as Record<string, unknown>;
    const rawScale = Number(body.scale);

    if (!Number.isFinite(rawScale)) {
      throw new HttpError(400, "Taille invalide");
    }

    await requireGmCampaign(request.params.campaignId, auth.user.id);

    const element = await prisma.sceneElement.findFirst({
      where: { id: request.params.elementId, campaignId: request.params.campaignId }
    });
    if (!element) throw new HttpError(404, "Element de scene introuvable");

    const scale = Math.max(0.5, Math.min(3, rawScale));

    await prisma.sceneElement.update({
      where: { id: element.id },
      data: { scale }
    });

    sseBroadcast(request.params.campaignId, {
      type: "element:scaled",
      elementId: element.id,
      scale
    });

    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

campaignsRouter.get("/campaigns/:campaignId/action-rolls/active", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const member = await requireCampaignMember(request.params.campaignId, auth.user.id);

    const rolls = await prisma.actionRoll.findMany({
      where: {
        campaignId: request.params.campaignId,
        status: { in: [ActionRollStatus.PENDING, ActionRollStatus.ROLLED] },
        ...(member.role === MemberRole.GM ? {} : { playerUserId: auth.user.id })
      },
      orderBy: { createdAt: "desc" }
    });

    response.json({ actionRolls: await Promise.all(rolls.map(serializeActionRoll)) });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/campaigns/:campaignId/action-rolls", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const body = request.body as Record<string, unknown>;

    await requireGmCampaign(request.params.campaignId, auth.user.id);

    const activeRoll = await prisma.actionRoll.findFirst({
      where: {
        campaignId: request.params.campaignId,
        status: { in: [ActionRollStatus.PENDING, ActionRollStatus.ROLLED] }
      }
    });
    if (activeRoll) throw new HttpError(400, "Une demande de jet est deja en cours");

    const playerUserId = assertString(body.playerUserId, "playerUserId");
    const actionText = assertString(body.actionText, "actionText");
    const dieSides = toInteger(body.dieSides, 20);
    const totalFailureMax = toInteger(body.totalFailureMax, 4);
    const successMin = toInteger(body.successMin, 12);
    const totalSuccessMin = toInteger(body.totalSuccessMin, 18);
    const targetType = assertString(body.targetType ?? "NONE", "targetType") as ActionRollTargetType;
    const targetElementId = optionalString(body.targetElementId);
    const targetUserId = optionalString(body.targetUserId);
    const consequenceType = assertString(body.consequenceType ?? "NONE", "consequenceType") as ActionRollConsequenceType;
    const consequenceAmount = Math.max(0, toInteger(body.consequenceAmount, 0));
    const consequenceText = optionalString(body.consequenceText) ?? "";
    const consequences = getOutcomeConsequences(body);

    if (![4, 6, 8, 10, 12, 20, 100].includes(dieSides)) {
      throw new HttpError(400, "Type de de invalide");
    }
    if (
      !Number.isInteger(totalFailureMax) ||
      !Number.isInteger(successMin) ||
      !Number.isInteger(totalSuccessMin) ||
      totalFailureMax < 1 ||
      successMin <= totalFailureMax ||
      totalSuccessMin < successMin ||
      totalSuccessMin > dieSides
    ) {
      throw new HttpError(400, "Seuils invalides");
    }
    if (!Object.values(ActionRollTargetType).includes(targetType)) {
      throw new HttpError(400, "Type de cible invalide");
    }
    if (!Object.values(ActionRollConsequenceType).includes(consequenceType)) {
      throw new HttpError(400, "Type de consequence invalide");
    }

    // Le lanceur est un membre de la campagne : un joueur, ou le MJ lui-meme
    // lorsqu'un element (PNJ/ennemi) attaque et que c'est le MJ qui lance le de.
    const playerMember = await prisma.campaignMember.findUnique({
      where: { campaignId_userId: { campaignId: request.params.campaignId, userId: playerUserId } }
    });
    if (!playerMember) {
      throw new HttpError(400, "Lanceur invalide pour ce jet");
    }

    // Un personnage a terre (0 PV) ne peut pas agir tant qu'il n'est pas soigne.
    // (Le MJ n'a pas de fiche : rollerSheet = null -> autorise pour les attaques d'ennemis.)
    const rollerSheet = await prisma.characterSheet.findUnique({
      where: { userId_campaignId: { userId: playerUserId, campaignId: request.params.campaignId } },
      select: { hp: true }
    });
    if (rollerSheet && rollerSheet.hp <= 0) {
      throw new HttpError(400, "Ce personnage est a terre (0 PV) : il doit etre soigne avant d'agir");
    }

    if (targetType === ActionRollTargetType.ELEMENT) {
      if (!targetElementId) throw new HttpError(400, "Cible element manquante");
      const target = await prisma.sceneElement.findFirst({
        where: { id: targetElementId, campaignId: request.params.campaignId }
      });
      if (!target) throw new HttpError(404, "Element cible introuvable");
    }

    if (targetType === ActionRollTargetType.PLAYER) {
      if (!targetUserId) throw new HttpError(400, "Cible joueur manquante");
      await requireCampaignMember(request.params.campaignId, targetUserId);
    }

    const roll = await prisma.actionRoll.create({
      data: {
        campaignId: request.params.campaignId,
        playerUserId,
        actionText,
        dieSides,
        totalFailureMax,
        successMin,
        totalSuccessMin,
        targetType,
        targetElementId: targetType === ActionRollTargetType.ELEMENT ? targetElementId : null,
        targetUserId: targetType === ActionRollTargetType.PLAYER ? targetUserId : null,
        consequenceType,
        consequenceAmount,
        consequenceText,
        totalFailureConsequenceType: consequences.TOTAL_FAILURE.type,
        totalFailureConsequenceAmount: consequences.TOTAL_FAILURE.amount,
        totalFailureConsequenceText: consequences.TOTAL_FAILURE.text,
        failureConsequenceType: consequences.FAILURE.type,
        failureConsequenceAmount: consequences.FAILURE.amount,
        failureConsequenceText: consequences.FAILURE.text,
        successConsequenceType: consequences.SUCCESS.type,
        successConsequenceAmount: consequences.SUCCESS.amount,
        successConsequenceText: consequences.SUCCESS.text,
        totalSuccessConsequenceType: consequences.TOTAL_SUCCESS.type,
        totalSuccessConsequenceAmount: consequences.TOTAL_SUCCESS.amount,
        totalSuccessConsequenceText: consequences.TOTAL_SUCCESS.text
      }
    });

    const payload = await serializeActionRoll(roll);
    sseBroadcast(request.params.campaignId, { type: "action-roll:changed", actionRoll: payload });
    response.status(201).json({ actionRoll: payload });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/campaigns/:campaignId/action-rolls/:rollId/roll", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const body = request.body as Record<string, unknown>;
    await requireCampaignMember(request.params.campaignId, auth.user.id);

    const existing = await prisma.actionRoll.findFirst({
      where: { id: request.params.rollId, campaignId: request.params.campaignId }
    });
    if (!existing) throw new HttpError(404, "Demande de jet introuvable");
    if (existing.playerUserId !== auth.user.id) throw new HttpError(403, "Ce jet est destine a un autre joueur");
    if (existing.status !== ActionRollStatus.PENDING) throw new HttpError(400, "Ce jet n'est pas en attente");

    const rollerSheet = await prisma.characterSheet.findUnique({
      where: { userId_campaignId: { userId: existing.playerUserId, campaignId: request.params.campaignId } },
      select: { hp: true }
    });
    if (rollerSheet && rollerSheet.hp <= 0) {
      throw new HttpError(400, "Ce personnage est a terre (0 PV) : il doit etre soigne avant d'agir");
    }

    const requestedResult = toInteger(body.result, 0);
    const result = requestedResult >= 1 && requestedResult <= existing.dieSides
      ? requestedResult
      : Math.floor(Math.random() * existing.dieSides) + 1;
    const roll = await prisma.actionRoll.update({
      where: { id: existing.id },
      data: { status: ActionRollStatus.ROLLED, result }
    });

    const payload = await serializeActionRoll(roll);
    sseBroadcast(request.params.campaignId, { type: "action-roll:changed", actionRoll: payload });
    response.json({ actionRoll: payload });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/campaigns/:campaignId/action-rolls/:rollId/reroll", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireGmCampaign(request.params.campaignId, auth.user.id);

    const existing = await prisma.actionRoll.findFirst({
      where: { id: request.params.rollId, campaignId: request.params.campaignId }
    });
    if (!existing) throw new HttpError(404, "Demande de jet introuvable");
    if (existing.status === ActionRollStatus.RESOLVED || existing.status === ActionRollStatus.CANCELLED) {
      throw new HttpError(400, "Ce jet est deja termine");
    }

    const roll = await prisma.actionRoll.update({
      where: { id: existing.id },
      data: { status: ActionRollStatus.PENDING, result: null }
    });

    const payload = await serializeActionRoll(roll);
    sseBroadcast(request.params.campaignId, { type: "action-roll:changed", actionRoll: payload });
    response.json({ actionRoll: payload });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/campaigns/:campaignId/action-rolls/:rollId/cancel", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireGmCampaign(request.params.campaignId, auth.user.id);

    const existing = await prisma.actionRoll.findFirst({
      where: { id: request.params.rollId, campaignId: request.params.campaignId }
    });
    if (!existing) throw new HttpError(404, "Demande de jet introuvable");

    const roll = await prisma.actionRoll.update({
      where: { id: existing.id },
      data: { status: ActionRollStatus.CANCELLED }
    });

    sseBroadcast(request.params.campaignId, { type: "action-roll:closed", actionRollId: roll.id });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/campaigns/:campaignId/action-rolls/:rollId/resolve", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await requireGmCampaign(request.params.campaignId, auth.user.id);

    const existing = await prisma.actionRoll.findFirst({
      where: { id: request.params.rollId, campaignId: request.params.campaignId }
    });
    if (!existing) throw new HttpError(404, "Demande de jet introuvable");
    if (existing.status !== ActionRollStatus.ROLLED) throw new HttpError(400, "Le joueur doit lancer le de avant resolution");

    const outcome = getRollOutcome(existing);
    if (!outcome) throw new HttpError(400, "Resultat de jet introuvable");
    const consequence = getStoredOutcomeConsequences(existing)[outcome];

    // Nom du personnage tombe a 0 PV lors de cette resolution (pour l'annonce a tous).
    let downedName: string | null = null;

    if (consequence.type === ActionRollConsequenceType.NARRATION && consequence.text.trim()) {
      await prisma.sceneElement.create({
        data: {
          campaignId: request.params.campaignId,
          type: SceneElementType.NARRATION,
          name: "Resolution",
          description: consequence.text.trim(),
          quantity: 1
        }
      });
    }

    if (consequence.type === ActionRollConsequenceType.DAMAGE_TARGET) {
      if (existing.targetType === ActionRollTargetType.ELEMENT && existing.targetElementId) {
        const target = await prisma.sceneElement.findFirst({
          where: { id: existing.targetElementId, campaignId: request.params.campaignId }
        });
        if (target) {
          await prisma.sceneElement.update({
            where: { id: target.id },
            data: { hp: Math.max(0, target.hp - consequence.amount) }
          });
        }
      }
      if (existing.targetType === ActionRollTargetType.PLAYER && existing.targetUserId) {
        const sheet = await prisma.characterSheet.findUnique({
          where: { userId_campaignId: { userId: existing.targetUserId, campaignId: request.params.campaignId } }
        });
        if (sheet) {
          const newHp = Math.max(0, sheet.hp - consequence.amount);
          await prisma.characterSheet.update({
            where: { id: sheet.id },
            data: { hp: newHp }
          });
          if (newHp === 0 && sheet.hp > 0) downedName = sheet.charName;
        }
      }
    }

    if (consequence.type === ActionRollConsequenceType.DAMAGE_PLAYER) {
      const targetUserId = existing.targetType === ActionRollTargetType.PLAYER && existing.targetUserId
        ? existing.targetUserId
        : existing.playerUserId;
      const sheet = await prisma.characterSheet.findUnique({
        where: { userId_campaignId: { userId: targetUserId, campaignId: request.params.campaignId } }
      });
      if (sheet) {
        const newHp = Math.max(0, sheet.hp - consequence.amount);
        await prisma.characterSheet.update({
          where: { id: sheet.id },
          data: { hp: newHp }
        });
        if (newHp === 0 && sheet.hp > 0) downedName = sheet.charName;
      }
    }

    if (consequence.type === ActionRollConsequenceType.HEAL_PLAYER) {
      const targetUserId = existing.targetType === ActionRollTargetType.PLAYER && existing.targetUserId
        ? existing.targetUserId
        : existing.playerUserId;
      const sheet = await prisma.characterSheet.findUnique({
        where: { userId_campaignId: { userId: targetUserId, campaignId: request.params.campaignId } }
      });
      if (sheet) {
        await prisma.characterSheet.update({
          where: { id: sheet.id },
          data: { hp: Math.min(sheet.maxHp, sheet.hp + consequence.amount) }
        });
      }
    }

    if (
      consequence.type === ActionRollConsequenceType.DELETE_TARGET &&
      existing.targetType === ActionRollTargetType.ELEMENT &&
      existing.targetElementId
    ) {
      const target = await prisma.sceneElement.findFirst({
        where: { id: existing.targetElementId, campaignId: request.params.campaignId }
      });
      if (target) await prisma.sceneElement.delete({ where: { id: target.id } });
    }

    const roll = await prisma.actionRoll.update({
      where: { id: existing.id },
      data: { status: ActionRollStatus.RESOLVED }
    });

    sseBroadcast(request.params.campaignId, { type: "action-roll:closed", actionRollId: roll.id });
    sseBroadcast(request.params.campaignId, { type: "campaign:changed" });
    if (downedName) {
      sseBroadcast(request.params.campaignId, { type: "player:down", name: downedName });
    }
    response.json({ actionRoll: await serializeActionRoll(roll) });
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
