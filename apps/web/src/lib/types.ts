export type User = {
  id: string;
  email: string;
  username: string;
  status: string;
};

export type CampaignStatus = "DRAFT" | "ACTIVE" | "CLOSED";

export type CampaignSummary = {
  memberId: string;
  role: "GM" | "PLAYER";
  campaign: {
    id: string;
    title: string;
    joinCode: string;
    status: CampaignStatus;
  };
};

export type SessionPayload = {
  user: User;
  campaigns: CampaignSummary[];
};

export type CampaignMemberView = {
  id: string;
  role: "GM" | "PLAYER";
  joinedAt: string | null;
  user: {
    id: string;
    username: string;
  };
};

export type CampaignDetail = {
  campaign: {
    id: string;
    title: string;
    joinCode: string;
    status: CampaignStatus;
    startedAt: string | null;
    endedAt: string | null;
    gmUser: {
      id: string;
      username: string;
    };
  };
  viewer: {
    memberId: string;
    role: "GM" | "PLAYER";
  };
  members: CampaignMemberView[];
  live: {
    scene: {
      preset: string;
      title: string;
      text: string;
    };
    players: Array<{
      userId: string;
      username: string;
      charName: string;
      charId: number;
      hp: number;
      maxHp: number;
    }>;
    elements: Array<{
      id: string;
      type: "ENEMY" | "NPC" | "OBJECT" | "NARRATION";
      name: string;
      description: string;
      quantity: number;
      isVisible: boolean;
      asset: {
        id: string;
        name: string;
        imageDataUrl: string;
      } | null;
    }>;
    assets: Array<{
      id: string;
      type: "ENEMY" | "NPC" | "OBJECT" | "NARRATION";
      name: string;
      imageDataUrl: string;
    }>;
  };
};

export type CampaignSummaryResponse = {
  campaign: {
    id: string;
    title: string;
    joinCode: string;
    status: CampaignStatus;
    gmUserId: string;
    startedAt: string | null;
    endedAt: string | null;
  };
};
