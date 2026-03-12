import { ActorType, CampaignStatus, MemberStatus } from "@prisma/client";

import { getCampaignMembership, requireCampaignGm } from "../lib/campaign-view.js";
import { assertString, HttpError, optionalNumber } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

const CAMPAIGN_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "CLOSED"] as const;
const MEMBER_STATUSES = ["INVITED", "ACTIVE", "LEFT", "BANNED"] as const;

type CampaignStatusValue = (typeof CAMPAIGN_STATUSES)[number];
type MemberStatusValue = (typeof MEMBER_STATUSES)[number];

function hasOwn(body: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function parseNullableText(value: unknown, fieldName: string) {
  if (value === null || value === "") {
    return null;
  }

  return assertString(value, fieldName);
}

function parseBoolean(value: unknown, fieldName: string) {
  if (typeof value !== "boolean") {
    throw new HttpError(400, `Champ invalide: ${fieldName}`);
  }

  return value;
}

function parseInteger(value: unknown, fieldName: string, min: number) {
  const parsed = optionalNumber(value);

  if (parsed === undefined || !Number.isInteger(parsed) || parsed < min) {
    throw new HttpError(400, `Champ invalide: ${fieldName}`);
  }

  return parsed;
}

function parseCampaignStatus(value: unknown): CampaignStatusValue {
  const status = assertString(value, "status").toUpperCase() as CampaignStatusValue;

  if (!CAMPAIGN_STATUSES.includes(status)) {
    throw new HttpError(400, "Statut de campagne invalide");
  }

  return status;
}

function parseMemberStatus(value: unknown): MemberStatusValue {
  const status = assertString(value, "status").toUpperCase() as MemberStatusValue;

  if (!MEMBER_STATUSES.includes(status)) {
    throw new HttpError(400, "Statut de membre invalide");
  }

  return status;
}

export async function updateCampaign(campaignId: string, userId: string, body: Record<string, unknown>) {
  await requireCampaignGm(campaignId, userId);

  const hasTitle = hasOwn(body, "title");
  const hasDescription = hasOwn(body, "description");
  const hasStatus = hasOwn(body, "status");

  if (!hasTitle && !hasDescription && !hasStatus) {
    throw new HttpError(400, "Aucune modification fournie");
  }

  const title = hasTitle ? assertString(body.title, "title") : undefined;
  const description = hasDescription ? parseNullableText(body.description, "description") : undefined;
  const status = hasStatus ? parseCampaignStatus(body.status) : undefined;

  const campaign = await prisma.campaign.update({
    where: {
      id: campaignId
    },
    data: {
      ...(hasTitle ? { title } : {}),
      ...(hasDescription ? { description } : {}),
      ...(hasStatus ? { status } : {})
    }
  });

  return { campaign };
}

export async function updateCampaignMember(
  campaignId: string,
  memberId: string,
  userId: string,
  body: Record<string, unknown>
) {
  await requireCampaignGm(campaignId, userId);

  const member = await prisma.campaignMember.findFirst({
    where: {
      id: memberId,
      campaignId
    }
  });

  if (!member) {
    throw new HttpError(404, "Membre introuvable pour cette campagne");
  }

  const hasStatus = hasOwn(body, "status");

  if (!hasStatus) {
    throw new HttpError(400, "Aucune modification fournie");
  }

  const status = parseMemberStatus(body.status);

  if (member.role === "GM" && status !== "ACTIVE") {
    throw new HttpError(400, "Le MJ principal ne peut pas etre desactive via cette route");
  }

  const updated = await prisma.campaignMember.update({
    where: {
      id: member.id
    },
    data: {
      status: status as MemberStatus,
      joinedAt: status === "ACTIVE" ? member.joinedAt ?? new Date() : member.joinedAt
    }
  });

  return { member: updated };
}

export async function deleteCampaign(campaignId: string, userId: string, mode: "soft" | "hard") {
  await requireCampaignGm(campaignId, userId);

  if (mode === "hard") {
    await prisma.campaign.delete({
      where: {
        id: campaignId
      }
    });

    return {
      deleted: true,
      mode
    };
  }

  const campaign = await prisma.campaign.update({
    where: {
      id: campaignId
    },
    data: {
      status: CampaignStatus.CLOSED,
      publishedSceneId: null,
      publishedVisualId: null,
      publishedAt: null
    }
  });

  return {
    deleted: false,
    mode,
    campaign
  };
}

export async function updateActor(actorId: string, userId: string, body: Record<string, unknown>) {
  const actor = await prisma.gameActor.findUnique({
    where: {
      id: actorId
    }
  });

  if (!actor) {
    throw new HttpError(404, "Acteur introuvable");
  }

  await requireCampaignGm(actor.campaignId, userId);

  if (actor.actorType === ActorType.PLAYER_CHARACTER) {
    throw new HttpError(400, "Utilise la route PATCH /characters/:characterId pour un personnage joueur");
  }

  const hasName = hasOwn(body, "name");
  const hasLevel = hasOwn(body, "level");
  const hasHpMax = hasOwn(body, "hpMax");
  const hasHpCurrent = hasOwn(body, "hpCurrent");
  const hasMjNotes = hasOwn(body, "mjNotes");
  const hasIsActive = hasOwn(body, "isActive");

  if (!hasName && !hasLevel && !hasHpMax && !hasHpCurrent && !hasMjNotes && !hasIsActive) {
    throw new HttpError(400, "Aucune modification fournie");
  }

  const name = hasName ? assertString(body.name, "name") : undefined;
  const level = hasLevel ? parseInteger(body.level, "level", 1) : undefined;
  const hpMax = hasHpMax ? parseInteger(body.hpMax, "hpMax", 1) : undefined;
  const hpCurrentInput = hasHpCurrent ? parseInteger(body.hpCurrent, "hpCurrent", 0) : undefined;
  const mjNotes = hasMjNotes ? parseNullableText(body.mjNotes, "mjNotes") : undefined;
  const isActive = hasIsActive ? parseBoolean(body.isActive, "isActive") : undefined;

  const nextHpMax = hpMax ?? actor.hpMax;

  if (hpCurrentInput !== undefined && hpCurrentInput > nextHpMax) {
    throw new HttpError(400, "hpCurrent ne peut pas depasser hpMax");
  }

  const hpCurrent =
    hpCurrentInput !== undefined
      ? hpCurrentInput
      : hpMax !== undefined && actor.hpCurrent > hpMax
        ? hpMax
        : undefined;

  const updated = await prisma.gameActor.update({
    where: {
      id: actor.id
    },
    data: {
      ...(hasName ? { name } : {}),
      ...(hasLevel ? { level } : {}),
      ...(hasHpMax ? { hpMax } : {}),
      ...(hpCurrent !== undefined ? { hpCurrent } : {}),
      ...(hasMjNotes ? { mjNotes } : {}),
      ...(hasIsActive ? { isActive } : {})
    }
  });

  return { actor: updated };
}

export async function deleteActor(actorId: string, userId: string) {
  const actor = await prisma.gameActor.findUnique({
    where: {
      id: actorId
    }
  });

  if (!actor) {
    throw new HttpError(404, "Acteur introuvable");
  }

  await requireCampaignGm(actor.campaignId, userId);

  const activeCombatParticipation = await prisma.combatParticipant.findFirst({
    where: {
      actorId: actor.id,
      combat: {
        status: {
          in: ["LIVE", "PAUSED"]
        }
      }
    }
  });

  if (activeCombatParticipation) {
    throw new HttpError(409, "Impossible de desactiver un acteur engage dans un combat actif");
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const deactivated = await transaction.gameActor.update({
      where: {
        id: actor.id
      },
      data: {
        isActive: false
      }
    });

    await transaction.sceneActor.deleteMany({
      where: {
        actorId: actor.id
      }
    });

    return deactivated;
  });

  return { actor: updated };
}

export async function updateCharacter(characterId: string, userId: string, body: Record<string, unknown>) {
  const character = await prisma.gameActor.findUnique({
    where: {
      id: characterId
    }
  });

  if (!character || character.actorType !== ActorType.PLAYER_CHARACTER) {
    throw new HttpError(404, "Personnage introuvable");
  }

  const membership = await getCampaignMembership(character.campaignId, userId);
  const viewerIsGm = membership.role === "GM" && membership.status === "ACTIVE";
  const viewerIsOwner = membership.id === character.ownerMemberId && membership.status === "ACTIVE";

  if (!viewerIsGm && !viewerIsOwner) {
    throw new HttpError(403, "Acces refuse a ce personnage");
  }

  const hasName = hasOwn(body, "name");
  const hasRaceId = hasOwn(body, "raceId");
  const hasClassId = hasOwn(body, "classId");
  const hasLevel = hasOwn(body, "level");
  const hasHpMax = hasOwn(body, "hpMax");
  const hasHpCurrent = hasOwn(body, "hpCurrent");
  const hasMjNotes = hasOwn(body, "mjNotes");
  const hasIsApproved = hasOwn(body, "isApproved");
  const hasIsActive = hasOwn(body, "isActive");

  if (
    !hasName &&
    !hasRaceId &&
    !hasClassId &&
    !hasLevel &&
    !hasHpMax &&
    !hasHpCurrent &&
    !hasMjNotes &&
    !hasIsApproved &&
    !hasIsActive
  ) {
    throw new HttpError(400, "Aucune modification fournie");
  }

  if (!viewerIsGm && (hasHpCurrent || hasIsApproved || hasIsActive)) {
    throw new HttpError(403, "Ces champs sont reserves au MJ");
  }

  const name = hasName ? assertString(body.name, "name") : undefined;
  const level = hasLevel ? parseInteger(body.level, "level", 1) : undefined;
  const hpMax = hasHpMax ? parseInteger(body.hpMax, "hpMax", 1) : undefined;
  const hpCurrentInput = hasHpCurrent ? parseInteger(body.hpCurrent, "hpCurrent", 0) : undefined;
  const mjNotes = hasMjNotes ? parseNullableText(body.mjNotes, "mjNotes") : undefined;
  const isApproved = hasIsApproved ? parseBoolean(body.isApproved, "isApproved") : undefined;
  const isActive = hasIsActive ? parseBoolean(body.isActive, "isActive") : undefined;

  const raceId = hasRaceId
    ? body.raceId === null || body.raceId === ""
      ? null
      : parseInteger(body.raceId, "raceId", 1)
    : undefined;

  const classId = hasClassId
    ? body.classId === null || body.classId === ""
      ? null
      : parseInteger(body.classId, "classId", 1)
    : undefined;

  if (typeof raceId === "number") {
    const race = await prisma.race.findUnique({ where: { id: raceId } });

    if (!race) {
      throw new HttpError(404, "Race introuvable");
    }
  }

  if (typeof classId === "number") {
    const characterClass = await prisma.characterClass.findUnique({ where: { id: classId } });

    if (!characterClass) {
      throw new HttpError(404, "Metier/classe introuvable");
    }
  }

  const nextHpMax = hpMax ?? character.hpMax;

  if (hpCurrentInput !== undefined && hpCurrentInput > nextHpMax) {
    throw new HttpError(400, "hpCurrent ne peut pas depasser hpMax");
  }

  const hpCurrent =
    hpCurrentInput !== undefined
      ? hpCurrentInput
      : hpMax !== undefined && character.hpCurrent > hpMax
        ? hpMax
        : undefined;

  const updated = await prisma.gameActor.update({
    where: {
      id: character.id
    },
    data: {
      ...(hasName ? { name } : {}),
      ...(hasRaceId ? { raceId } : {}),
      ...(hasClassId ? { classId } : {}),
      ...(hasLevel ? { level } : {}),
      ...(hasHpMax ? { hpMax } : {}),
      ...(hpCurrent !== undefined ? { hpCurrent } : {}),
      ...(hasMjNotes ? { mjNotes } : {}),
      ...(hasIsApproved ? { isApproved } : {}),
      ...(hasIsActive ? { isActive } : {})
    }
  });

  return { actor: updated };
}
