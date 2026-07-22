export type IntelligenceSourceKind =
  | "creator-profile"
  | "channel-data"
  | "market-data"
  | "research"
  | "manual";

export type IntelligenceSource = {
  sourceId: string;
  providerId: string;
  kind: IntelligenceSourceKind;
  collectedAt: string;
  payload: Readonly<Record<string, unknown>>;
};

export type IntelligenceSignal = {
  id: string;
  type: string;
  sourceIds: ReadonlyArray<string>;
  confidence: number;
  payload: Readonly<Record<string, unknown>>;
};

export type IntelligenceRecommendation = {
  id: string;
  actionCode: string;
  rationaleCode: string;
  priority: "low" | "medium" | "high" | "critical";
  evidenceSignalIds: ReadonlyArray<string>;
};
