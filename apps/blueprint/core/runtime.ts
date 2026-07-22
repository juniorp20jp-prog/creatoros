import {
  CREATOR_INTELLIGENCE_ENGINE_ID,
  creatorIntelligenceEngine,
  type CreatorIntelligenceInput,
  type CreatorIntelligenceOutput,
} from "./engines/creator-intelligence";
import { EngineRegistry } from "./engines/engine-registry";
import {
  YOUTUBE_INTELLIGENCE_ENGINE_ID,
  youtubeIntelligenceEngine,
  type YouTubeIntelligenceInput,
  type YouTubeIntelligenceOutput,
} from "./engines/youtube-intelligence";
import {
  EngineRuntime,
  type EngineRuntimeOptions,
} from "./services/engine-runtime";

export type CoreEngineContracts = {
  [CREATOR_INTELLIGENCE_ENGINE_ID]: {
    input: CreatorIntelligenceInput;
    output: CreatorIntelligenceOutput;
  };
  [YOUTUBE_INTELLIGENCE_ENGINE_ID]: {
    input: YouTubeIntelligenceInput;
    output: YouTubeIntelligenceOutput;
  };
};

export const coreEngineRegistry =
  new EngineRegistry<CoreEngineContracts>();

coreEngineRegistry.register(creatorIntelligenceEngine);
coreEngineRegistry.register(youtubeIntelligenceEngine);

export const coreEngineRuntime = new EngineRuntime(coreEngineRegistry);

export function executeCreatorIntelligence(
  input: CreatorIntelligenceInput,
  options: EngineRuntimeOptions = {},
) {
  return coreEngineRuntime.execute(
    CREATOR_INTELLIGENCE_ENGINE_ID,
    input,
    options,
  );
}

export function executeYouTubeIntelligence(
  input: YouTubeIntelligenceInput,
  options: EngineRuntimeOptions = {},
) {
  return coreEngineRuntime.execute(
    YOUTUBE_INTELLIGENCE_ENGINE_ID,
    input,
    options,
  );
}
