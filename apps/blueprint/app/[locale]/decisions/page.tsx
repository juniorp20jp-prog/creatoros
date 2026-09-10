import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { executeYouTubeIntelligence, generateCreatorDecisionsFromYouTubeAnalytics } from "../../../core";
import {
  createCreatorDecisionCenterViewModel,
  CreatorDecisionCenter,
  creatorDecisionScenarioIds,
  creatorDecisionScenarios,
  isCreatorDecisionScenarioId,
  parseCategoryFilter,
  parsePriorityFilter,
  RealCreatorDecisionExperience,
  type CreatorDecisionScenarioId,
  type DecisionSourceContext,
} from "../../../features/creator-decisions";
import { isValidLocale, type Locale } from "../../../i18n/config";
import { getDictionary } from "../../../i18n/dictionaries";

type DecisionCenterPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    mode?: string | ReadonlyArray<string>;
    analysisRunId?: string | ReadonlyArray<string>;
    scenario?: string | ReadonlyArray<string>;
    priority?: string | ReadonlyArray<string>;
    category?: string | ReadonlyArray<string>;
  }>;
};

function first(value: string | ReadonlyArray<string> | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
async function resolveLocale(params: DecisionCenterPageProps["params"]) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  return locale;
}
function dataQuality(analytics: Awaited<ReturnType<typeof executeYouTubeIntelligence>>): DecisionSourceContext["quality"] {
  if (analytics.status === "failed") return "unavailable";
  const quality = analytics.output.dataQuality;
  return quality.fields.partiallyAvailable.length > 0 || quality.fields.absent.length > 0 || quality.warnings.length > 0 || quality.excludedVideos.length > 0 ? "partial" : "complete";
}
export async function generateMetadata({ params }: DecisionCenterPageProps): Promise<Metadata> {
  const locale = await resolveLocale(params);
  return (await getDictionary(locale)).blueprint.creatorDecisions.metadata;
}
export default async function DecisionCenterPage({ params, searchParams }: DecisionCenterPageProps) {
  const locale: Locale = await resolveLocale(params);
  const dictionary = await getDictionary(locale);
  const query = await searchParams;
  const content = dictionary.blueprint.creatorDecisions;
  const filters = {
    priority: parsePriorityFilter(first(query.priority)),
    category: parseCategoryFilter(first(query.category)),
  };
  if (first(query.mode) !== "demo") {
    return (
      <RealCreatorDecisionExperience
        content={content}
        filters={filters}
        locale={locale}
        requestedAnalysisRunId={first(query.analysisRunId)}
      />
    );
  }

  const requestedScenario = first(query.scenario);
  const scenarioId: CreatorDecisionScenarioId = requestedScenario === undefined
    ? "complete"
    : isCreatorDecisionScenarioId(requestedScenario) ? requestedScenario : notFound();
  const input = creatorDecisionScenarios[scenarioId];
  const analytics = await executeYouTubeIntelligence(input, { locale, correlationId: `creator-decisions-${scenarioId}` });
  const result = generateCreatorDecisionsFromYouTubeAnalytics(analytics);
  const source: DecisionSourceContext = {
    channelName: input.channel.name,
    analysisDate: input.context.analysisDate,
    period: input.context.period,
    sampleSize: analytics.status === "completed" ? analytics.output.dataQuality.effectiveVideoCount : null,
    quality: dataQuality(analytics),
    hasInsufficientEvidence: analytics.status === "completed" && analytics.output.dataQuality.unevaluatedSignals.some((signal) => signal.reason === "insufficient-sample") && !analytics.output.dataQuality.unevaluatedSignals.some((signal) => signal.reason === "no-qualifying-evidence"),
  };
  const viewModel = createCreatorDecisionCenterViewModel({ content, filters, locale, result, scenarioId, source, mode: "demo" });
  const scenarios = creatorDecisionScenarioIds.map((id) => ({ id, label: content.scenarios[id].label, description: content.scenarios[id].description }));
  return <CreatorDecisionCenter content={content} locale={locale} scenarios={scenarios} viewModel={viewModel} />;
}