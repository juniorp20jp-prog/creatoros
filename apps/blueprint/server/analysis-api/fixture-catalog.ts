import {
  fixtureChannelData,
  type FixtureChannelDataId,
} from "../../core";
import type {
  AnalysisFixture,
  AnalysisFixtureCatalog,
} from "./contracts";

const fixtureIdentity: Readonly<
  Record<
    FixtureChannelDataId,
    { creatorId: string; channelId: string }
  >
> = {
  complete: {
    creatorId: "creator_fixture_complete",
    channelId: "channel_fixture_complete",
  },
  partial: {
    creatorId: "creator_fixture_partial",
    channelId: "channel_fixture_partial",
  },
  noVideos: {
    creatorId: "creator_fixture_empty",
    channelId: "channel_fixture_empty",
  },
  invalidMetrics: {
    creatorId: "creator_fixture_invalid",
    channelId: "channel_fixture_invalid",
  },
  unknownFields: {
    creatorId: "creator_fixture_complete",
    channelId: "channel_fixture_complete",
  },
};

const fixtures = new Map<string, AnalysisFixture>(
  (
    Object.keys(fixtureChannelData) as FixtureChannelDataId[]
  ).map((fixtureId) => [
    fixtureId,
    {
      fixtureId,
      ...fixtureIdentity[fixtureId],
      sourceData: fixtureChannelData[fixtureId],
    },
  ]),
);

export class InternalAnalysisFixtureCatalog
  implements AnalysisFixtureCatalog
{
  get(fixtureId: string): AnalysisFixture | undefined {
    return fixtures.get(fixtureId);
  }

  listIds(): ReadonlyArray<string> {
    return [...fixtures.keys()].sort();
  }
}
