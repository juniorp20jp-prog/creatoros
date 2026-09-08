export type {
  ChannelDataAdapter,
  ChannelDataAdapterDefinition,
  ChannelDataAdapterError,
  ChannelDataAdapterErrorCode,
  ChannelDataAdapterFailure,
  ChannelDataAdapterMetadata,
  ChannelDataAdapterPartial,
  ChannelDataAdapterResult,
  ChannelDataAdapterSuccess,
  ChannelDataAdapterWarning,
  ChannelDataAdapterWarningCode,
} from "./contracts";
export {
  FixtureChannelDataAdapter,
} from "./fixture-channel-data-adapter";
export {
  FIXTURE_CHANNEL_DATA_SCHEMA_VERSION,
} from "./fixture-source";
export type {
  FixtureChannelDataSource,
  FixtureChannelSource,
  FixtureCreatorSource,
  FixtureVideoSource,
} from "./fixture-source";
export {
  fixtureChannelData,
} from "./fixtures";
export type {
  FixtureChannelDataId,
} from "./fixtures";
export {
  executeAdaptedChannelAnalysis,
} from "./integration";
export type {
  ChannelDataAnalysisIntegrationResult,
} from "./integration";

export { PersistedYouTubeChannelDataAdapter, PERSISTED_YOUTUBE_SOURCE_SCHEMA_VERSION } from "./persisted-youtube-channel-data-adapter";
export type { PersistedYouTubeChannelData } from "./persisted-youtube-channel-data-adapter";
