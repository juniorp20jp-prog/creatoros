import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { executeYouTubeIntelligence } from "../../../core";
import {
  createYouTubeAnalyzerViewModel,
  isYouTubeAnalyzerScenarioId,
  YouTubeAnalyzer,
  youtubeAnalyzerScenarioIds,
  youtubeAnalyzerScenarios,
  type YouTubeAnalyzerScenarioId,
  type YouTubeAnalyzerScenarioOption,
} from "../../../features/youtube-analyzer";
import { isValidLocale, type Locale } from "../../../i18n/config";
import { getDictionary } from "../../../i18n/dictionaries";

type YouTubeAnalyzerPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ scenario?: string | ReadonlyArray<string> }>;
};

async function resolveLocale(params: YouTubeAnalyzerPageProps["params"]) {
  const { locale } = await params;
  if (!isValidLocale(locale)) {
    notFound();
  }
  return locale;
}

export async function generateMetadata({
  params,
}: YouTubeAnalyzerPageProps): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dictionary = await getDictionary(locale);

  return {
    title: dictionary.blueprint.youtubeAnalyzer.metadata.title,
    description: dictionary.blueprint.youtubeAnalyzer.metadata.description,
  };
}

export default async function YouTubeAnalyzerPage({
  params,
  searchParams,
}: YouTubeAnalyzerPageProps) {
  const locale: Locale = await resolveLocale(params);
  const dictionary = await getDictionary(locale);
  const query = await searchParams;
  const requestedScenario = Array.isArray(query.scenario)
    ? query.scenario[0]
    : query.scenario;
  const scenarioId: YouTubeAnalyzerScenarioId | null =
    requestedScenario === undefined
      ? null
      : isYouTubeAnalyzerScenarioId(requestedScenario)
        ? requestedScenario
        : null;
  const content = dictionary.blueprint.youtubeAnalyzer;
  const scenarios: ReadonlyArray<YouTubeAnalyzerScenarioOption> =
    youtubeAnalyzerScenarioIds.map((id) => ({
      id,
      label: content.scenarios[id].label,
      description: content.scenarios[id].description,
    }));

  if (scenarioId === null) {
    return (
      <YouTubeAnalyzer
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
    const result = await executeYouTubeIntelligence(input, {
      locale,
      correlationId: `youtube-analyzer-${scenarioId}`,
    });
    viewModel = createYouTubeAnalyzerViewModel(scenarioId, result);
  } catch {
    viewModel = {
      state: "unexpected-error" as const,
      scenarioId,
      errorCode: "YOUTUBE_ANALYZER_UNEXPECTED_ERROR",
    };
  }

  return (
    <YouTubeAnalyzer
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
