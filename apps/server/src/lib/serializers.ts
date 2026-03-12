import type {
  CampaignInvite,
  CampaignMember,
  CharacterClass,
  Combat,
  CombatParticipant,
  GameActor,
  Race,
  Reward,
  RewardAssignment,
  Scene,
  SceneActor,
  SceneVisual,
  User,
  VisualShare
} from "@prisma/client";

type ActorWithRelations = GameActor & {
  race: Race | null;
  characterClass: CharacterClass | null;
  ownerMember: (CampaignMember & {
    user: Pick<User, "id" | "username" | "email">;
  }) | null;
};

type SceneActorWithActor = SceneActor & {
  actor: ActorWithRelations;
};

type SceneWithRelations = Scene & {
  visuals: SceneVisual[];
  actorLinks: SceneActorWithActor[];
};

type CombatParticipantWithActor = CombatParticipant & {
  actor: ActorWithRelations;
};

type CombatWithRelations = Combat & {
  participants: CombatParticipantWithActor[];
  actions: Array<{
    id: string;
    actionType: string;
    actionLabel: string;
    damageValue: number | null;
    healingValue: number | null;
    resultText: string | null;
    performedAt: Date;
    sourceParticipant: CombatParticipantWithActor;
    targetParticipant: CombatParticipantWithActor | null;
  }>;
};

type RewardWithAssignments = Reward & {
  assignments: (RewardAssignment & {
    actor: ActorWithRelations | null;
  })[];
};

export function serializeMember(member: CampaignMember & { user: Pick<User, "id" | "username" | "email"> }) {
  return {
    id: member.id,
    role: member.role,
    status: member.status,
    joinedAt: member.joinedAt,
    user: member.user
  };
}

export function serializeInvite(invite: CampaignInvite, baseUrl: string) {
  return {
    id: invite.id,
    targetEmail: invite.targetEmail,
    status: invite.status,
    expiresAt: invite.expiresAt,
    token: invite.token,
    joinUrl: `${baseUrl}/invite/${invite.token}`
  };
}

export function serializeActor(actor: ActorWithRelations) {
  return {
    id: actor.id,
    actorType: actor.actorType,
    name: actor.name,
    level: actor.level,
    hpMax: actor.hpMax,
    hpCurrent: actor.hpCurrent,
    isApproved: actor.isApproved,
    isActive: actor.isActive,
    mjNotes: actor.mjNotes,
    race: actor.race,
    characterClass: actor.characterClass,
    owner: actor.ownerMember
      ? {
          memberId: actor.ownerMember.id,
          username: actor.ownerMember.user.username,
          email: actor.ownerMember.user.email
        }
      : null
  };
}

export function serializeScene(scene: SceneWithRelations, playerMode = false) {
  return {
    id: scene.id,
    title: scene.title,
    summary: scene.summary,
    playerText: scene.playerText,
    gmNotes: playerMode ? undefined : scene.gmNotes,
    displayOrder: scene.displayOrder,
    status: scene.status,
    visuals: scene.visuals,
    actors: scene.actorLinks
      .filter((link) => !playerMode || link.visibilityScope === "ALL_PLAYERS")
      .map((link) => ({
        id: link.id,
        narrativeRole: link.narrativeRole,
        visibilityScope: link.visibilityScope,
        actor: serializeActor(link.actor)
      }))
  };
}

export function serializeCombat(combat: CombatWithRelations | null) {
  if (!combat) {
    return null;
  }

  return {
    id: combat.id,
    status: combat.status,
    roundNo: combat.roundNo,
    mjValidated: combat.mjValidated,
    notes: combat.notes,
    startedAt: combat.startedAt,
    endedAt: combat.endedAt,
    participants: combat.participants.map((participant) => ({
      id: participant.id,
      side: participant.side,
      initiative: participant.initiative,
      currentHp: participant.currentHp,
      status: participant.status,
      actor: serializeActor(participant.actor)
    })),
    actions: combat.actions.map((action) => ({
      id: action.id,
      actionType: action.actionType,
      actionLabel: action.actionLabel,
      damageValue: action.damageValue,
      healingValue: action.healingValue,
      resultText: action.resultText,
      performedAt: action.performedAt,
      sourceParticipantId: action.sourceParticipant.id,
      sourceActorName: action.sourceParticipant.actor.name,
      targetParticipantId: action.targetParticipant?.id ?? null,
      targetActorName: action.targetParticipant?.actor.name ?? null
    }))
  };
}

export function serializeReward(reward: RewardWithAssignments) {
  return {
    id: reward.id,
    rewardType: reward.rewardType,
    label: reward.label,
    description: reward.description,
    numericValue: reward.numericValue ? Number(reward.numericValue) : null,
    createdAt: reward.createdAt,
    assignments: reward.assignments.map((assignment) => ({
      id: assignment.id,
      actorId: assignment.actorId,
      actorName: assignment.actor?.name ?? null,
      quantity: Number(assignment.quantity),
      grantedAt: assignment.grantedAt
    }))
  };
}

export function filterSharesForMember(shares: VisualShare[], memberId: string) {
  return shares.some((share) => share.memberId === memberId);
}

