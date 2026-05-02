export type User = {
  id: string;
  email: string;
  username: string;
  status: string;
  isAdmin: boolean;
};

export type CampaignStatus = "DRAFT" | "ACTIVE" | "CLOSED";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

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

export type ImageContext = {
  id: string;
  name: string;
  imageDataUrl: string;
  isBuiltin: boolean;
  ownerId: string | null;
  createdAt: string;
};

export type TextContext = {
  id: string;
  title: string;
  content: string;
  approvalStatus: ApprovalStatus;
  ownerId: string;
  createdAt: string;
  isPublishedInCurrentCampaign?: boolean;
  canBeSharedAcrossMj?: boolean;
  owner?: {
    id: string;
    username: string;
  };
};

export type PublishedText = TextContext & {
  publishedEntryId: string;
  publishedAt: string;
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
    currentImageContext: ImageContext | null;
    currentTextContext: TextContext | null;
  };
  viewer: {
    memberId: string;
    role: "GM" | "PLAYER";
  };
  members: CampaignMemberView[];
  libraries: {
    imageContexts: ImageContext[];
    textContexts: TextContext[];
  };
  publishedTexts: PublishedText[];
  moderationQueue: TextContext[];
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
