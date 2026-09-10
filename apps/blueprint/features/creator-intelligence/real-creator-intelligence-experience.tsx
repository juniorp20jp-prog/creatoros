"use client";

import { useEffect, useState } from "react";

import type { Locale } from "../../i18n/config";
import { AnalysisApiClient, useAnalysis, useAnalysisList } from "../analysis-integration";
import { createCreatorIntelligenceViewModel } from "./model";
import type { CreatorIntelligenceDictionary } from "./types";
import { CreatorIntelligenceWorkspace } from "./creator-intelligence-workspace";
import styles from "./creator-intelligence.module.css";

export function RealCreatorIntelligenceExperience({
  content,
  locale,
  requestedAnalysisRunId,
  client,
}: {
  content: CreatorIntelligenceDictionary;
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
    return <RealState content={content} kind="loading" />;
  }
  if (list.status === "empty") return <RealState content={content} kind="empty" />;
  if (list.status === "error" || list.status === "cancelled") {
    return <RealState content={content} kind="error" retry={list.retry} />;
  }
  if (details.status === "idle" || details.status === "loading" || details.status === "retry") {
    return <RealState content={content} kind="loading" />;
  }
  if (details.status === "error" || details.status === "cancelled" || !details.data?.analysisResult) {
    return <RealState content={content} kind="error" retry={details.retry} />;
  }

  const projection = details.data.analysisResult.strategicProjection;
  if (!projection || projection.schemaVersion !== 1) {
    return <RealState content={content} kind="reanalysis" />;
  }
  const output = projection.sourceIntelligence.output;
  return (
    <CreatorIntelligenceWorkspace
      analysisRunId={details.data.summary.analysisRunId}
      content={content}
      locale={locale}
      mode="real"
      scenario={{
        id: "complete",
        channelName: output.summary.channel.name,
        period: output.context.period,
      }}
      scenarios={[]}
      viewModel={createCreatorIntelligenceViewModel("complete", projection.creatorIntelligence)}
    />
  );
}

function RealState({
  content,
  kind,
  retry,
}: {
  content: CreatorIntelligenceDictionary;
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