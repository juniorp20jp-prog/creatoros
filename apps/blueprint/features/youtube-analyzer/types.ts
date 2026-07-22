import type { Dictionary } from "../../i18n/dictionaries";
import type { YouTubeAnalyzerScenarioId } from "./fixtures";

export type YouTubeAnalyzerDictionary =
  Dictionary["blueprint"]["youtubeAnalyzer"];

export type YouTubeAnalyzerScenarioOption = {
  id: YouTubeAnalyzerScenarioId;
  label: string;
  description: string;
};
