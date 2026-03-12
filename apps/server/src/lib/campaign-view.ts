import { MemberRole, MemberStatus } from "@prisma/client";

import { env } from "../env.js";
import { HttpError } from "./http.js";
import { prisma } from "./prisma.js";
import {
  filterSharesForMember,
  serializeActor,
  serializeCombat,
  serializeInvite,
  serializeMember,
  serializeReward,
  serializeScene
} from "./serializers.js";

export async function getCampaignMembership(campaignId: string, userId: string) {
  const membership = await prisma.campaignMember.findUnique({
    where: {
      campaignId_userId: {
        campaignId,
        userId
      }
    }
  });

  if (!membership || membership.status === MemberStatus.BANNED || membership.status === MemberStatus.LEFT) {
    throw new HttpError(403, "Acces refuse a cette campagne");
  }

  return membership;
}

export async function requireCampaignGm(campaignId: string, userId: string) {
  const membership = await getCampaignMembership(campaignId, userId);

  if (membership.role !== MemberRole.GM || membership.status !== MemberStatus.ACTIVE) {
    throw new HttpError(403, "Acces reserve au MJ de la campagne");
  }

  return membership;
}

export async function buildCampaignPayload(campaignId: string, userId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: {
      id: campaignId
    },
    include: {
      gmUser: {
        select: {
          id: true,
          username: true,
          email: true
        }
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: "asc"
        }
      },
      invites: {
        orderBy: {
          createdAt: "desc"
        }
      },
      actors: {
        include: {
          race: true,
          characterClass: true,
          ownerMember: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: "asc"
        }
      },
      scenes: {
        include: {
          visuals: true,
          actorLinks: {
            include: {
              actor: {
                include: {
                  race: true,
                  characterClass: true,
                  ownerMember: {
                    include: {
                      user: {
                        select: {
                          id: true,
                          username: true,
                          email: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: [
          {
            displayOrder: "asc"
          },
          {
            createdAt: "asc"
          }
        ]
      },
      publishedScene: {
        include: {
          visuals: true,
          actorLinks: {
            include: {
              actor: {
                include: {
                  race: true,
                  characterClass: true,
                  ownerMember: {
                    include: {
                      user: {
                        select: {
                          id: true,
                          username: true,
                          email: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      publishedVisual: {
        include: {
          shares: true
        }
      },
      combats: {
        where: {
          status: {
            in: ["LIVE", "PAUSED"]
          }
        },
        include: {
          participants: {
            include: {
              actor: {
                include: {
                  race: true,
                  characterClass: true,
                  ownerMember: {
                    include: {
                      user: {
                        select: {
                          id: true,
                          username: true,
                          email: true
                        }
                      }
                    }
                  }
                }
              }
            },
            orderBy: {
              createdAt: "asc"
            }
          },
          actions: {
            include: {
              sourceParticipant: {
                include: {
                  actor: {
                    include: {
                      race: true,
                      characterClass: true,
                      ownerMember: {
                        include: {
                          user: {
                            select: {
                              id: true,
                              username: true,
                              email: true
                            }
                          }
                        }
                      }
                    }
                  }
                }
              },
              targetParticipant: {
                include: {
                  actor: {
                    include: {
                      race: true,
                      characterClass: true,
                      ownerMember: {
                        include: {
                          user: {
                            select: {
                              id: true,
                              username: true,
                              email: true
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            orderBy: {
              performedAt: "desc"
            },
            take: 10
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      },
      rewards: {
        include: {
          assignments: {
            include: {
              actor: {
                include: {
                  race: true,
                  characterClass: true,
                  ownerMember: {
                    include: {
                      user: {
                        select: {
                          id: true,
                          username: true,
                          email: true
                        }
                      }
                    }
                  }
                }
              }
            },
            orderBy: {
              grantedAt: "desc"
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });

  if (!campaign) {
    throw new HttpError(404, "Campagne introuvable");
  }

  const membership = campaign.members.find((item) => item.user.id === userId);

  if (!membership || membership.status === MemberStatus.BANNED || membership.status === MemberStatus.LEFT) {
    throw new HttpError(403, "Acces refuse a cette campagne");
  }

  const viewerIsGm = membership.role === MemberRole.GM;
  const activeCombat = campaign.combats[0] ?? null;
  const myCharacters = campaign.actors.filter((actor) => actor.ownerMemberId === membership.id);
  const approvedParty = campaign.actors.filter((actor) => actor.actorType === "PLAYER_CHARACTER" && actor.isApproved);

  const visibleActorMap = new Map<string, ReturnType<typeof serializeActor>>();

  if (campaign.publishedScene) {
    for (const link of campaign.publishedScene.actorLinks) {
      if (viewerIsGm || link.visibilityScope === "ALL_PLAYERS") {
        visibleActorMap.set(link.actor.id, serializeActor(link.actor));
      }
    }
  }

  if (activeCombat) {
    for (const participant of activeCombat.participants) {
      visibleActorMap.set(participant.actor.id, serializeActor(participant.actor));
    }
  }

  const publishedVisual =
    campaign.publishedVisual && (viewerIsGm || filterSharesForMember(campaign.publishedVisual.shares, membership.id))
      ? {
          id: campaign.publishedVisual.id,
          label: campaign.publishedVisual.label,
          mediaType: campaign.publishedVisual.mediaType,
          assetUrl: campaign.publishedVisual.assetUrl
        }
      : null;

  return {
    campaign: {
      id: campaign.id,
      title: campaign.title,
      description: campaign.description,
      status: campaign.status,
      publishedAt: campaign.publishedAt,
      gmUser: campaign.gmUser
    },
    viewer: {
      memberId: membership.id,
      role: membership.role,
      status: membership.status
    },
    references: {
      races: await prisma.race.findMany({ orderBy: { name: "asc" } }),
      classes: await prisma.characterClass.findMany({ orderBy: { name: "asc" } }),
      actorTemplates: await prisma.actorTemplate.findMany({ orderBy: { name: "asc" } })
    },
    roster: campaign.members.map(serializeMember),
    partyStatus: approvedParty.map(serializeActor),
    myCharacters: myCharacters.map(serializeActor),
    currentView: {
      publishedScene: campaign.publishedScene ? serializeScene(campaign.publishedScene, !viewerIsGm) : null,
      publishedVisual,
      visibleActors: [...visibleActorMap.values()],
      activeCombat: serializeCombat(activeCombat),
      latestRewards: campaign.rewards.slice(0, 6).map(serializeReward)
    },
    gm: viewerIsGm
      ? {
          invites: campaign.invites.map((invite) => serializeInvite(invite, env.clientOrigin)),
          actors: campaign.actors.map(serializeActor),
          pendingCharacters: campaign.actors
            .filter((actor) => actor.actorType === "PLAYER_CHARACTER" && !actor.isApproved)
            .map(serializeActor),
          scenes: campaign.scenes.map((scene) => serializeScene(scene, false)),
          activeCombat: serializeCombat(activeCombat),
          rewards: campaign.rewards.map(serializeReward)
        }
      : null
  };
}

