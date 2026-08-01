import type { Dictionary } from "../../i18n/dictionaries";

export type MissionControlContent =
  Dictionary["blueprint"]["missionControl"];

export type MissionControlNotice = {
  kind: "success" | "error" | "cancelled";
  message: string;
};

export const missionControlDemo = {
  fixtureId: "complete",
  creatorId: "creator_fixture_complete",
  channelId: "channel_fixture_complete",
} as const;
