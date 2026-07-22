import type { Locale } from "../../i18n/config";
import type { YouTubeAnalyzerScenarioId } from "./fixtures";
import type {
  YouTubeAnalyzerSuccessViewModel,
  YouTubeAnalyzerViewModel,
} from "./model";
import type {
  YouTubeAnalyzerDictionary,
  YouTubeAnalyzerScenarioOption,
} from "./types";
import { AnalysisLimitations } from "./components/AnalysisLimitations";
import { AnalysisOverview } from "./components/AnalysisOverview";
import { AnalyzerHeader } from "./components/AnalyzerHeader";
import {
  AnalyzerEmptyState,
  AnalyzerErrorState,
} from "./components/AnalyzerStates";
import { DataQualityPanel } from "./components/DataQualityPanel";
import { PublishingInsights } from "./components/PublishingInsights";
import { SignalsPanel } from "./components/SignalsPanel";
import { VideoPerformanceTable } from "./components/VideoPerformanceTable";
import styles from "./youtube-analyzer.module.css";

type YouTubeAnalyzerProps = {
  content: YouTubeAnalyzerDictionary;
  locale: Locale;
  scenario: {
    id: YouTubeAnalyzerScenarioId;
    channelName: string;
    period: { startDate: string; endDate: string };
  } | null;
  scenarios: ReadonlyArray<YouTubeAnalyzerScenarioOption>;
  viewModel: YouTubeAnalyzerViewModel | null;
};

function isSuccessfulViewModel(
  viewModel: YouTubeAnalyzerViewModel,
): viewModel is YouTubeAnalyzerSuccessViewModel {
  return (
    viewModel.state === "success" ||
    viewModel.state === "partial-data" ||
    viewModel.state === "insufficient-sample"
  );
}

export function YouTubeAnalyzer({
  content,
  locale,
  scenario,
  scenarios,
  viewModel,
}: YouTubeAnalyzerProps) {
  const state = viewModel?.state ?? "empty";
  const successfulViewModel =
    viewModel && isSuccessfulViewModel(viewModel) ? viewModel : null;

  return (
    <div className={styles.analyzer} lang={locale}>
      <AnalyzerHeader
        channelName={scenario?.channelName ?? content.overview.notAvailable}
        content={content}
        locale={locale}
        period={scenario?.period ?? null}
        scenarioId={scenario?.id ?? null}
        scenarios={scenarios}
        state={state}
      />

      {viewModel === null ? <AnalyzerEmptyState content={content} /> : null}

      {viewModel?.state === "validation-error" ||
      viewModel?.state === "unexpected-error" ? (
        <AnalyzerErrorState
          content={content}
          errorCode={viewModel.errorCode}
          type={viewModel.state}
        />
      ) : null}

      {successfulViewModel ? (
        <div aria-live="polite" className={styles.analysisContent}>
          <AnalysisOverview
            content={content}
            locale={locale}
            metrics={successfulViewModel.metrics}
          />
          <PublishingInsights
            content={content}
            locale={locale}
            publishing={successfulViewModel.publishing}
          />
          <VideoPerformanceTable
            content={content}
            locale={locale}
            videos={successfulViewModel.videos}
          />
          <SignalsPanel
            content={content}
            locale={locale}
            signals={successfulViewModel.signals}
          />
          <DataQualityPanel
            content={content}
            quality={successfulViewModel.quality}
          />
        </div>
      ) : null}

      <AnalysisLimitations content={content} />
    </div>
  );
}
