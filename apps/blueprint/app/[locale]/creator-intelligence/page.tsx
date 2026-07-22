import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  executeYouTubeIntelligence,
  interpretCreatorIntelligence,
} from "../../../core";
import {
  createCreatorIntelligenceViewModel,
  CreatorIntelligenceWorkspace,
  type CreatorIntelligenceScenarioOption,
} from "../../../features/creator-intelligence";
import {
  isYouTubeAnalyzerScenarioId,
  youtubeAnalyzerScenarioIds,
  youtubeAnalyzerScenarios,
  type YouTubeAnalyzerScenarioId,
} from "../../../features/youtube-analyzer";
import { isValidLocale, type Locale } from "../../../i18n/config";
import { getDictionary } from "../../../i18n/dictionaries";

type CreatorIntelligencePageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ scenario?: string | ReadonlyArray<string> }>;
};

async function resolveLocale(params: CreatorIntelligencePageProps["params"]) {
  const { locale } = await params;
  if (!isValidLocale(locale)) {
    notFound();
  }
  return locale;
}

export async function generateMetadata({
  params,
}: CreatorIntelligencePageProps): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dictionary = await getDictionary(locale);
  return {
    title: dictionary.blueprint.creatorIntelligence.metadata.title,
    description: dictionary.blueprint.creatorIntelligence.metadata.description,
  };
}

export default async function CreatorIntelligencePage({
  params,
  searchParams,
}: CreatorIntelligencePageProps) {
  const locale: Locale = await resolveLocale(params);
  const dictionary = await getDictionary(locale);
  const query = await searchParams;
  const requestedScenario = Array.isArray(query.scenario)
    ? query.scenario[0]
    : query.scenario;
  const scenarioId: YouTubeAnalyzerScenarioId | null =
    requestedScenario === undefined
      ? "complete"
      : isYouTubeAnalyzerScenarioId(requestedScenario)
        ? requestedScenario
        : null;
  const content = dictionary.blueprint.creatorIntelligence;
  const scenarios: ReadonlyArray<CreatorIntelligenceScenarioOption> =
    youtubeAnalyzerScenarioIds.map((id) => ({
      id,
      label: dictionary.blueprint.youtubeAnalyzer.scenarios[id].label,
      description:
        dictionary.blueprint.youtubeAnalyzer.scenarios[id].description,
    }));

  if (scenarioId === null) {
    return (
      <CreatorIntelligenceWorkspace
        content={content}
        locale={locale}
        scenario={null}
        scenarios={scenarios}
        viewModel={null}
      />
    );
  }

  const input = youtubeAnalyzerScenarios[scenarioId];
  let viewModel;
  try {
    const analyticsResult = await executeYouTubeIntelligence(input, {
      locale,
      correlationId: `creator-intelligence-${scenarioId}`,
    });
    const intelligenceResult = interpretCreatorIntelligence(analyticsResult);
    viewModel = createCreatorIntelligenceViewModel(
      scenarioId,
      intelligenceResult,
    );
  } catch {
    viewModel = {
      state: "unexpected-error" as const,
      scenarioId,
      errorCode: "CREATOR_INTELLIGENCE_UNEXPECTED_ERROR",
      failureReason: "unexpected-error",
    };
  }

  return (
    <CreatorIntelligenceWorkspace
      content={content}
      locale={locale}
      scenario={{
        id: scenarioId,
        channelName: input.channel.name,
        period: input.context.period,
      }}
      scenarios={scenarios}
      viewModel={viewModel}
    />
  );
}
