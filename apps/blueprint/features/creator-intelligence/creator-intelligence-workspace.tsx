import type { Locale } from "../../i18n/config";
import type { CreatorIntelligenceSuccessViewModel, CreatorIntelligenceViewModel } from "./model";
import type { CreatorIntelligenceDictionary, CreatorIntelligenceScenarioId, CreatorIntelligenceScenarioOption } from "./types";
import { AnalysisContext } from "./components/AnalysisContext";
import { AnalysisLimitations } from "./components/AnalysisLimitations";
import { EvidenceSection } from "./components/EvidenceSection";
import { ExecutiveBrief } from "./components/ExecutiveBrief";
import { InsightGrid } from "./components/InsightGrid";
import { IntelligenceHeader } from "./components/IntelligenceHeader";
import { IntelligenceQualityPanel } from "./components/IntelligenceQuality";
import { IntelligenceEmptyState, IntelligenceErrorState, IntelligenceNoInsightsState } from "./components/IntelligenceStates";
import { NextStepPanel } from "./components/NextStepPanel";
import styles from "./creator-intelligence.module.css";

type CreatorIntelligenceWorkspaceProps = {
  content: CreatorIntelligenceDictionary;
  locale: Locale;
  scenario: { id: CreatorIntelligenceScenarioId; channelName: string; period: { startDate: string; endDate: string } } | null;
  scenarios: ReadonlyArray<CreatorIntelligenceScenarioOption>;
  viewModel: CreatorIntelligenceViewModel | null;
  mode?: "real" | "demo";
  analysisRunId?: string;
};
function isSuccessfulViewModel(viewModel: CreatorIntelligenceViewModel): viewModel is CreatorIntelligenceSuccessViewModel {
  return viewModel.state === "success" || viewModel.state === "partial-data" || viewModel.state === "insufficient-sample";
}
export function CreatorIntelligenceWorkspace({ content, locale, scenario, scenarios, viewModel, mode = "demo", analysisRunId }: CreatorIntelligenceWorkspaceProps) {
  const state = viewModel?.state ?? "empty";
  const successfulViewModel = viewModel && isSuccessfulViewModel(viewModel) ? viewModel : null;
  const activeScenario = scenarios.find((option) => option.id === scenario?.id);
  return (
    <div className={styles.workspace} lang={locale}>
      <IntelligenceHeader analysisRunId={analysisRunId} channelName={scenario?.channelName ?? content.common.notAvailable} content={content} locale={locale} mode={mode} period={scenario?.period ?? null} scenarioId={scenario?.id ?? null} scenarios={scenarios} state={state} />
      {viewModel === null ? <IntelligenceEmptyState content={content} /> : null}
      {viewModel?.state === "validation-error" || viewModel?.state === "unexpected-error" ? <IntelligenceErrorState content={content} errorCode={viewModel.errorCode} type={viewModel.state} /> : null}
      {successfulViewModel ? (
        <div aria-live="polite" className={styles.intelligenceContent}>
          <ExecutiveBrief brief={successfulViewModel.brief} content={content} />
          {!successfulViewModel.hasInsights ? <IntelligenceNoInsightsState content={content} /> : null}
          <InsightGrid content={content} eyebrow={content.insights.priorityEyebrow} insights={successfulViewModel.priorityInsights} locale={locale} title={content.insights.priorityTitle} titleId="priority-insights-title" />
          <InsightGrid content={content} eyebrow={content.insights.additionalEyebrow} insights={successfulViewModel.additionalInsights} locale={locale} title={content.insights.additionalTitle} titleId="additional-insights-title" />
          <EvidenceSection content={content} evidence={successfulViewModel.evidence} locale={locale} />
          <AnalysisContext content={content} context={successfulViewModel.context} locale={locale} scenarioLabel={mode === "real" ? content.realMode.sourceLabel : activeScenario?.label ?? content.common.notAvailable} />
          <IntelligenceQualityPanel content={content} quality={successfulViewModel.quality} />
          <AnalysisLimitations content={content} limitations={successfulViewModel.limitations} />
          <NextStepPanel content={content} />
        </div>
      ) : null}
    </div>
  );
}