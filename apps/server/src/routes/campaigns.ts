import { randomBytes } from "node:crypto";

import { ApprovalStatus, MemberRole, Prisma } from "@prisma/client";
import { Router } from "express";

import { assertString, HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const campaignsRouter = Router();

const campaignDetailInclude = Prisma.validator<Prisma.CampaignInclude>()({
  gmUser: { select: { id: true, username: true } },
  currentImageContext: true,
  currentTextContext: {
    include: {
      owner: {
        select: {
          id: true,
          username: true
        }
      }
    }
  },
  members: {
    include: {
      user: { select: { id: true, username: true } }
    },
    orderBy: { joinedAt: "asc" }
  },
  publishedTextEntries: {
    include: {
      textContext: {
        include: {
          owner: {
            select: {
              id: true,
              username: true
            }
          }
        }
      }
    },
    orderBy: { publishedAt: "asc" }
  }
});

type CampaignWithRelations = Prisma.CampaignGetPayload<{
  include: typeof campaignDetailInclude;
}>;

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

function serializeImageContext(image: {
  id: string;
  name: string;
  imageDataUrl: string;
  isBuiltin: boolean;
  ownerId: string | null;
  createdAt: Date;
}) {
  return {
    id: image.id,
    name: image.name,
    imageDataUrl: image.imageDataUrl,
    isBuiltin: image.isBuiltin,
    ownerId: image.ownerId,
    createdAt: image.createdAt
  };
}

function serializeTextContext(text: {
  id: string;
  title: string;
  content: string;
  approvalStatus: ApprovalStatus;
  ownerId: string;
  createdAt: Date;
  owner?: { id: string; username: string };
  isPublishedInCurrentCampaign?: boolean;
  canBeSharedAcrossMj?: boolean;
}) {
  return {
    id: text.id,
    title: text.title,
    content: text.content,
    approvalStatus: text.approvalStatus,
    ownerId: text.ownerId,
    createdAt: text.createdAt,
    owner: text.owner,
    isPublishedInCurrentCampaign: text.isPublishedInCurrentCampaign ?? false,
    canBeSharedAcrossMj: text.canBeSharedAcrossMj ?? text.approvalStatus === ApprovalStatus.APPROVED
  };
}

function readOptionalId(value: unknown, fieldName: string) {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `Champ invalide: ${fieldName}`);
  }

  return value.trim();
}

function assertImageDataUrl(value: unknown) {
  const imageDataUrl = assertString(value, "imageDataUrl");

  if (!imageDataUrl.startsWith("data:image/")) {
    throw new HttpError(400, "L'image doit etre fournie au format data URL");
  }

  return imageDataUrl;
}

function canUseTextContextInCampaign(params: {
  textOwnerId: string;
  approvalStatus: ApprovalStatus;
  campaignGmUserId: string;
  requesterIsAdmin: boolean;
}) {
  return (
    params.textOwnerId === params.campaignGmUserId ||
    params.approvalStatus === ApprovalStatus.APPROVED ||
    params.requesterIsAdmin
  );
}

async function getCampaignForMember(campaignId: string, userId: string) {
  const campaign = (await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: campaignDetailInclude
  })) as CampaignWithRelations | null;

  if (!campaign) {
    throw new HttpError(404, "Partie introuvable");
  }

  const viewer = campaign.members.find((member) => member.userId === userId);

  if (!viewer) {
    throw new HttpError(403, "Tu ne participes pas a cette partie");
  }

  return { campaign, viewer };
}

async function buildCampaignPayload(campaignId: string, user: { id: string; isAdmin: boolean }) {
  const [{ campaign, viewer }, imageContexts, textContexts, moderationQueue] = await Promise.all([
    getCampaignForMember(campaignId, user.id),
    prisma.contextImage.findMany({
      where: {
        OR: [{ isBuiltin: true }, { ownerId: user.id }]
      },
      orderBy: [{ isBuiltin: "desc" }, { createdAt: "desc" }]
    }),
    prisma.contextText.findMany({
      where: {
        OR: [{ ownerId: user.id }, { approvalStatus: ApprovalStatus.APPROVED }]
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true
          }
        }
      },
      orderBy: [{ approvalStatus: "asc" }, { createdAt: "desc" }]
    }),
    user.isAdmin
      ? prisma.contextText.findMany({
          where: {
            approvalStatus: ApprovalStatus.PENDING
          },
          include: {
            owner: {
              select: {
                id: true,
                username: true
              }
            }
          },
          orderBy: {
            createdAt: "asc"
          }
        })
      : Promise.resolve([])
  ]);

  const publishedTextIds = new Set(campaign.publishedTextEntries.map((entry) => entry.textContextId));

  return {
    campaign: {
      id: campaign.id,
      title: campaign.title,
      joinCode: campaign.joinCode,
      status: campaign.status,
      startedAt: campaign.startedAt,
      endedAt: campaign.endedAt,
      gmUser: campaign.gmUser,
      currentImageContext: campaign.currentImageContext
        ? serializeImageContext(campaign.currentImageContext)
        : null,
      currentTextContext: campaign.currentTextContext
        ? serializeTextContext(campaign.currentTextContext)
        : null
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
    })),
    libraries: {
      imageContexts: imageContexts.map(serializeImageContext),
      textContexts: textContexts.map((text) =>
        serializeTextContext({
          ...text,
          isPublishedInCurrentCampaign: publishedTextIds.has(text.id),
          canBeSharedAcrossMj: text.approvalStatus === ApprovalStatus.APPROVED
        })
      )
    },
    publishedTexts: campaign.publishedTextEntries.map((entry) =>
      ({
        ...serializeTextContext({
          ...entry.textContext,
          isPublishedInCurrentCampaign: true,
          canBeSharedAcrossMj: entry.textContext.approvalStatus === ApprovalStatus.APPROVED
        }),
        publishedEntryId: entry.id,
        publishedAt: entry.publishedAt
      })
    ),
    moderationQueue: moderationQueue.map(serializeTextContext)
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
    response.json(await buildCampaignPayload(request.params.campaignId, auth.user));
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/campaigns/:campaignId/context", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const body = request.body as Record<string, unknown>;
    const requestedImageContextId = readOptionalId(body.imageContextId, "imageContextId");
    const textContextId = readOptionalId(body.textContextId, "textContextId");

    const campaign = await prisma.campaign.findUnique({
      where: { id: request.params.campaignId }
    });

    if (!campaign) {
      throw new HttpError(404, "Partie introuvable");
    }

    if (campaign.gmUserId !== auth.user.id) {
      throw new HttpError(403, "Seul le MJ peut modifier le contexte");
    }

    const imageContextId = requestedImageContextId ?? campaign.currentImageContextId ?? null;

    if (imageContextId) {
      const imageContext = await prisma.contextImage.findUnique({
        where: { id: imageContextId }
      });

      if (!imageContext) {
        throw new HttpError(404, "Image de contexte introuvable");
      }

      if (!imageContext.isBuiltin && imageContext.ownerId !== auth.user.id) {
        throw new HttpError(403, "Cette image de contexte n'est pas disponible");
      }
    }

    if (textContextId) {
      const textContext = await prisma.contextText.findUnique({
        where: { id: textContextId }
      });

      if (!textContext) {
        throw new HttpError(404, "Texte de contexte introuvable");
      }

      const canUseText = canUseTextContextInCampaign({
        textOwnerId: textContext.ownerId,
        approvalStatus: textContext.approvalStatus,
        campaignGmUserId: campaign.gmUserId,
        requesterIsAdmin: auth.user.isAdmin
      });

      if (!canUseText) {
        throw new HttpError(
          403,
          "Ce texte peut etre utilise tout de suite par son MJ createur, mais doit etre valide par un admin avant d'etre partage a d'autres MJ"
        );
      }
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        currentImageContextId: imageContextId,
        currentTextContextId: textContextId
      }
    });

    if (textContextId && textContextId !== campaign.currentTextContextId) {
      await (prisma as any).campaignPublishedText.create({
        data: {
          campaignId: campaign.id,
          textContextId
        }
      });
    }

    response.json(await buildCampaignPayload(campaign.id, auth.user));
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/context-images", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const body = request.body as Record<string, unknown>;

    const imageContext = await prisma.contextImage.create({
      data: {
        name: assertString(body.name, "name"),
        imageDataUrl: assertImageDataUrl(body.imageDataUrl),
        ownerId: auth.user.id
      }
    });

    response.status(201).json({ imageContext: serializeImageContext(imageContext) });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/context-texts", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const body = request.body as Record<string, unknown>;

    const textContext = await prisma.contextText.create({
      data: {
        title: assertString(body.title, "title"),
        content: assertString(body.content, "content"),
        ownerId: auth.user.id,
        approvalStatus: auth.user.isAdmin ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    response.status(201).json({ textContext: serializeTextContext(textContext) });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/context-texts/:textContextId/approve", async (request, response, next) => {
  try {
    const auth = requireAuth(request);

    if (!auth.user.isAdmin) {
      throw new HttpError(403, "Validation reservee a l'admin");
    }

    const textContext = await prisma.contextText.update({
      where: {
        id: request.params.textContextId
      },
      data: {
        approvalStatus: ApprovalStatus.APPROVED
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    response.json({ textContext: serializeTextContext(textContext) });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/context-texts/:textContextId/reject", async (request, response, next) => {
  try {
    const auth = requireAuth(request);

    if (!auth.user.isAdmin) {
      throw new HttpError(403, "Validation reservee a l'admin");
    }

    const textContext = await prisma.contextText.update({
      where: {
        id: request.params.textContextId
      },
      data: {
        approvalStatus: ApprovalStatus.REJECTED
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    response.json({ textContext: serializeTextContext(textContext) });
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
