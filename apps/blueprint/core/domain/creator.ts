export type CreatorPlatform =
  | "youtube"
  | "instagram"
  | "tiktok"
  | "podcast"
  | "newsletter"
  | "other";

export type CreatorChannelReference = {
  platform: CreatorPlatform;
  externalId?: string;
  handle?: string;
};

export type CreatorContext = {
  creatorId: string;
  displayName?: string;
  locale?: string;
  channels: ReadonlyArray<CreatorChannelReference>;
};

export type CreatorObjectiveKind =
  | "audience-growth"
  | "engagement"
  | "content-consistency"
  | "revenue"
  | "custom";

export type CreatorObjective = {
  id: string;
  kind: CreatorObjectiveKind;
  target?: number;
  targetDate?: string;
};
