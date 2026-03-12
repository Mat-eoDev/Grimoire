export type User = {
  id: string;
  email: string;
  username: string;
  status: string;
};

export type CampaignSummary = {
  memberId: string;
  role: "GM" | "PLAYER";
  status: string;
  campaign: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    publishedAt: string | null;
    memberCount: number;
  };
};

export type SessionPayload = {
  user: User;
  campaigns: CampaignSummary[];
};

export type ReferencePayload = {
  races: Array<{ id: number; code: string; name: string; description: string | null }>;
  classes: Array<{ id: number; code: string; name: string; description: string | null }>;
  actorTemplates: Array<{ id: string; name: string; actorType: "NPC" | "MONSTER"; level: number; hpMax: number; summary: string | null }>;
};

export type Actor = {
  id: string;
  actorType: "PLAYER_CHARACTER" | "NPC" | "MONSTER";
  name: string;
  level: number;
  hpMax: number;
  hpCurrent: number;
  isApproved: boolean;
  isActive: boolean;
  mjNotes: string | null;
  race: { id: number; name: string } | null;
  characterClass: { id: number; name: string } | null;
  owner: { memberId: string; username: string; email: string } | null;
};

export type SceneVisual = {
  id: string;
  label: string;
  mediaType: string;
  assetUrl: string;
};

export type ScenePayload = {
  id: string;
  title: string;
  summary: string | null;
  playerText: string | null;
  gmNotes?: string | null;
  displayOrder: number;
  status: string;
  visuals: SceneVisual[];
  actors: Array<{
    id: string;
    narrativeRole: string | null;
    visibilityScope: string;
    actor: Actor;
  }>;
};

export type CombatPayload = {
  id: string;
  status: string;
  roundNo: number;
  mjValidated: boolean;
  notes: string | null;
  startedAt: string | null;
  endedAt: string | null;
  participants: Array<{
    id: string;
    side: string;
    initiative: number | null;
    currentHp: number;
    status: string;
    actor: Actor;
  }>;
  actions: Array<{
    id: string;
    actionType: string;
    actionLabel: string;
    damageValue: number | null;
    healingValue: number | null;
    resultText: string | null;
    performedAt: string;
    sourceParticipantId: string;
    sourceActorName: string;
    targetParticipantId: string | null;
    targetActorName: string | null;
  }>;
} | null;

export type RewardPayload = {
  id: string;
  rewardType: string;
  label: string;
  description: string | null;
  numericValue: number | null;
  createdAt: string;
  assignments: Array<{
    id: string;
    actorId: string | null;
    actorName: string | null;
    quantity: number;
    grantedAt: string;
  }>;
};

export type CampaignPayload = {
  campaign: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    publishedAt: string | null;
    gmUser: {
      id: string;
      username: string;
      email: string;
    };
  };
  viewer: {
    memberId: string;
    role: "GM" | "PLAYER";
    status: string;
  };
  references: ReferencePayload;
  roster: Array<{
    id: string;
    role: "GM" | "PLAYER";
    status: string;
    joinedAt: string | null;
    user: {
      id: string;
      username: string;
      email: string;
    };
  }>;
  partyStatus: Actor[];
  myCharacters: Actor[];
  currentView: {
    publishedScene: ScenePayload | null;
    publishedVisual: SceneVisual | null;
    visibleActors: Actor[];
    activeCombat: CombatPayload;
    latestRewards: RewardPayload[];
  };
  gm: null | {
    invites: Array<{
      id: string;
      targetEmail: string;
      status: string;
      expiresAt: string;
      token: string;
      joinUrl: string;
    }>;
    actors: Actor[];
    pendingCharacters: Actor[];
    scenes: ScenePayload[];
    activeCombat: CombatPayload;
    rewards: RewardPayload[];
  };
};

