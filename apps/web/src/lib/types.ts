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
  isReady: boolean;
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
      type: "ENEMY" | "NPC" | "OBJECT" | "NARRATION" | "PLAYER";
      name: string;
      description: string;
      quantity: number;
      isVisible: boolean;
      posX: number;
      posY: number;
      asset: {
        id: string;
        name: string;
        imageDataUrl: string;
      } | null;
    }>;
    assets: Array<{
      id: string;
      type: "ENEMY" | "NPC" | "OBJECT" | "NARRATION" | "PLAYER";
      name: string;
      imageDataUrl: string;
    }>;
  };
};

export type ItemType = "WEAPON" | "SHIELD" | "CONSUMABLE" | "MISC";

export type Item = {
  id: string;
  slug: string;
  name: string;
  type: ItemType;
  imageFile: string;
  description: string;
  equipable: boolean;
};

export type InventoryEntry = {
  id: string;
  quantity: number;
  equipped: boolean;
  bonusMaxHp: number;
  bonusAttack: number;
  bonusDefense: number;
  bonusSpeed: number;
  bonusMagic: number;
  effectHp: number;
  item: Item;
};

export type TradeOffer = {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  offeredEntryId: string;
  offeredQty: number;
  requestedEntryId: string | null;
  requestedQty: number;
  status: "PENDING" | "ACCEPTED" | "REFUSED" | "CANCELLED";
  createdAt: string;
  offeredEntry: InventoryEntry | null;
  requestedEntry: InventoryEntry | null;
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
