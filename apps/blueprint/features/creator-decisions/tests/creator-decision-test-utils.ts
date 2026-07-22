import {
  executeYouTubeIntelligence,
  generateCreatorDecisionsFromYouTubeAnalytics,
} from "../../../core";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import fr from "../../../messages/fr.json";
import ptBR from "../../../messages/pt-BR.json";
import type { Locale } from "../../../i18n/config";
import {
  creatorDecisionScenarios,
  type CreatorDecisionScenarioId,
} from "../fixtures";
import { createCreatorDecisionCenterViewModel } from "../model";
import type {
  CreatorDecisionCenterViewModel,
  CreatorDecisionDictionary,
  CreatorDecisionFilters,
  DecisionSourceContext,
} from "../types";

const dictionaries = {
  en,
  es,
  fr,
  "pt-BR": ptBR,
};

export async function createScenarioViewModel(
  scenarioId: CreatorDecisionScenarioId,
  locale: Locale = "en",
  filters: CreatorDecisionFilters = { priority: "all", category: "all" },
): Promise<{
  content: CreatorDecisionDictionary;
  viewModel: CreatorDecisionCenterViewModel;
}> {
  const input = creatorDecisionScenarios[scenarioId];
  const analytics = await executeYouTubeIntelligence(input, {
    locale,
    correlationId: `test-decisions-${scenarioId}`,
  });
  const source: DecisionSourceContext = {
    channelName: input.channel.name,
    analysisDate: input.context.analysisDate,
    period: input.context.period,
    sampleSize:
      analytics.status === "completed"
        ? analytics.output.dataQuality.effectiveVideoCount
        : null,
    quality: analytics.status === "completed" ? "complete" : "unavailable",
    hasInsufficientEvidence:
      analytics.status === "completed" &&
      analytics.output.dataQuality.unevaluatedSignals.some(
        (signal) => signal.reason === "insufficient-sample",
      ) &&
      !analytics.output.dataQuality.unevaluatedSignals.some(
        (signal) => signal.reason === "no-qualifying-evidence",
      ),
  };
  const content = dictionaries[locale].blueprint.creatorDecisions;
  return {
    content,
    viewModel: createCreatorDecisionCenterViewModel({
      content,
      filters,
      locale,
      result: generateCreatorDecisionsFromYouTubeAnalytics(analytics),
      scenarioId,
      source,
    }),
  };
}
