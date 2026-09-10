"use client";

import { useEffect, useState } from "react";

import type { Locale } from "../../i18n/config";
import { AnalysisApiClient, useAnalysis, useAnalysisList } from "../analysis-integration";
import { CreatorDecisionCenter } from "./creator-decision-center";
import { createCreatorDecisionCenterViewModel } from "./model";
import type { CreatorDecisionDictionary, CreatorDecisionFilters, DecisionSourceContext } from "./types";
import styles from "./creator-decisions.module.css";

export function RealCreatorDecisionExperience({
  content,
  filters,
  locale,
  requestedAnalysisRunId,
  client,
}: {
  content: CreatorDecisionDictionary;
  filters: CreatorDecisionFilters;
  locale: Locale;
  requestedAnalysisRunId?: string;
  client?: AnalysisApiClient;
}) {
  const [apiClient] = useState(() => client ?? new AnalysisApiClient());
  const list = useAnalysisList(apiClient, { source: "connected-youtube", limit: 20 });
  const [selectedId, setSelectedId] = useState(requestedAnalysisRunId?.trim() || "");
  useEffect(() => {
    if (selectedId || list.status !== "success" || !list.data) return;
    const latest = list.data.items.find((item) => item.status === "completed" || item.status === "partial");
    if (latest) setSelectedId(latest.analysisRunId);
  }, [list.data, list.status, selectedId]);
  const details = useAnalysis(apiClient, selectedId || undefined);

  if (list.status === "loading" || list.status === "retry" || (list.status === "success" && !selectedId)) {
    return <RealDecisionState content={content} kind="loading" />;
  }
  if (list.status === "empty") return <RealDecisionState content={content} kind="empty" />;
  if (list.status === "error" || list.status === "cancelled") return <RealDecisionState content={content} kind="error" retry={list.retry} />;
  if (details.status === "idle" || details.status === "loading" || details.status === "retry") return <RealDecisionState content={content} kind="loading" />;
  if (details.status === "error" || details.status === "cancelled" || !details.data?.analysisResult) return <RealDecisionState content={content} kind="error" retry={details.retry} />;

  const projection = details.data.analysisResult.strategicProjection;
  if (!projection || projection.schemaVersion !== 1) return <RealDecisionState content={content} kind="reanalysis" />;
  const analytics = projection.sourceIntelligence.output;
  const quality: DecisionSourceContext["quality"] = projection.creatorIntelligence.status === "failure"
    ? "unavailable"
    : projection.creatorIntelligence.quality.status;
  const source: DecisionSourceContext = {
    channelName: analytics.summary.channel.name,
    analysisDate: projection.generatedAt,
    period: analytics.context.period,
    sampleSize: analytics.dataQuality.effectiveVideoCount,
    quality,
    hasInsufficientEvidence: analytics.dataQuality.unevaluatedSignals.some((signal) => signal.reason === "insufficient-sample"),
  };
  const viewModel = createCreatorDecisionCenterViewModel({
    content,
    filters,
    locale,
    mode: "real",
    result: projection.decisions,
    scenarioId: "complete",
    source,
  });
  return (
    <CreatorDecisionCenter
      analysisRunId={details.data.summary.analysisRunId}
      content={content}
      locale={locale}
      mode="real"
      scenarios={[]}
      viewModel={viewModel}
    />
  );
}

function RealDecisionState({
  content,
  kind,
  retry,
}: {
  content: CreatorDecisionDictionary;
  kind: "loading" | "empty" | "error" | "reanalysis";
  retry?: () => void;
}) {
  const copy = kind === "loading"
    ? { title: content.realMode.loading, description: content.realMode.loadingDescription }
    : kind === "empty"
      ? { title: content.realMode.emptyTitle, description: content.realMode.emptyDescription }
      : kind === "reanalysis"
        ? { title: content.realMode.reanalysisTitle, description: content.realMode.reanalysisDescription }
        : { title: content.realMode.errorTitle, description: content.realMode.errorDescription };
  return (
    <section aria-live="polite" className={styles.statePanel} role={kind === "error" ? "alert" : "status"}>
      <p className={styles.eyebrow}>{content.realMode.badge}</p>
      <h2>{copy.title}</h2>
      <p>{copy.description}</p>
      {retry ? <button className={styles.retryButton} onClick={retry} type="button">{content.realMode.retry}</button> : null}
    </section>
  );
}