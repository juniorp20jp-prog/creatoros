"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@repo/ui";

import type { Locale } from "../../i18n/config";
import {
  AnalysisApiClient,
  useAnalysis,
  useAnalysisHistory,
  useAnalysisList,
  useDeleteAnalysis,
  useReplay,
  useRunAnalysis,
  useStatusSummary,
} from "../analysis-integration";
import { YouTubeApiClient, useYouTubeConnection } from "../youtube-connection";
import { safeErrorMessage } from "./formatters";
import {
  missionControlDemo,
  type MissionControlContent,
  type MissionControlNotice,
} from "./types";
import { AnalysisInspector, type InspectorView } from "./components/AnalysisInspector";
import { AnalysisList } from "./components/AnalysisList";
import { MissionControlHeader } from "./components/MissionControlHeader";
import { StatusSummaryGrid } from "./components/StatusSummaryGrid";
import styles from "./mission-control-analysis.module.css";

type MissionControlAnalysisExperienceProps = {
  content: MissionControlContent;
  locale: Locale;
  client?: AnalysisApiClient;
  youtubeClient?: YouTubeApiClient;
  mode?: "real" | "demo";
};

export function MissionControlAnalysisExperience({
  content,
  locale,
  client,
  youtubeClient,
  mode = "demo",
}: MissionControlAnalysisExperienceProps) {
  const [apiClient] = useState(() => client ?? new AnalysisApiClient());
  const [channelClient] = useState(() => youtubeClient ?? new YouTubeApiClient());
  const channelContext = useYouTubeConnection(channelClient);
  const realMode = mode === "real";
  const [selectedAnalysisRunId, setSelectedAnalysisRunId] = useState<string | null>(null);
  const [inspectorView, setInspectorView] = useState<InspectorView>("details");
  const [cursor, setCursor] = useState<string | undefined>();
  const [cursorHistory, setCursorHistory] = useState<ReadonlyArray<string | undefined>>([]);
  const [notice, setNotice] = useState<MissionControlNotice | null>(null);
  const operationLock = useRef(false);
  const activeOperation = useRef<"run" | "replay" | "delete" | null>(null);

  const summary = useStatusSummary(apiClient, realMode
    ? { source: "connected-youtube" }
    : { source: "fixture", channelId: missionControlDemo.channelId });
  const analysisList = useAnalysisList(apiClient, {
    ...(realMode
      ? { source: "connected-youtube" as const }
      : { source: "fixture" as const, channelId: missionControlDemo.channelId }),
    limit: 10,
    ...(cursor ? { cursor } : {}),
  });
  const details = useAnalysis(apiClient, selectedAnalysisRunId ?? undefined);
  const history = useAnalysisHistory(apiClient, selectedAnalysisRunId ?? undefined);
  const runAnalysis = useRunAnalysis(apiClient);
  const replay = useReplay(apiClient);
  const deleteAnalysis = useDeleteAnalysis(apiClient);
  const { error: runError, status: runStatus } = runAnalysis;
  const { error: replayError, status: replayStatus } = replay;
  const { error: deleteError, status: deleteStatus } = deleteAnalysis;

  const refreshCollections = useCallback(() => {
    summary.retry();
    analysisList.retry();
  }, [analysisList, summary]);

  const selectAnalysis = useCallback((analysisRunId: string, view: InspectorView) => {
    setSelectedAnalysisRunId(analysisRunId);
    setInspectorView(view);
  }, []);

  const handleRun = useCallback(async () => {
    if (operationLock.current) {
      return;
    }
    operationLock.current = true;
    activeOperation.current = "run";
    setNotice(null);
    try {
      const result = await runAnalysis.execute(
        realMode
          ? { source: "connected-youtube" }
          : { source: "fixture", ...missionControlDemo },
      );
      if (result) {
        activeOperation.current = null;
        setSelectedAnalysisRunId(result.analysisRunId);
        setInspectorView("details");
        setNotice({ kind: "success", message: content.feedback.runSuccess });
        refreshCollections();
      }
    } finally {
      operationLock.current = false;
    }
  }, [content, realMode, refreshCollections, runAnalysis]);

  const handleReplay = useCallback(async (analysisRunId: string) => {
    if (operationLock.current || !globalThis.confirm(content.confirmations.replay)) {
      return;
    }
    operationLock.current = true;
    activeOperation.current = "replay";
    setNotice(null);
    try {
      const result = await replay.execute({
        analysisRunId,
        request: realMode
          ? { source: "connected-youtube" }
          : { source: "fixture", fixtureId: missionControlDemo.fixtureId },
      });
      if (result) {
        activeOperation.current = null;
        setSelectedAnalysisRunId(result.analysisRunId);
        setInspectorView("history");
        setNotice({ kind: "success", message: content.feedback.replaySuccess });
        refreshCollections();
      }
    } finally {
      operationLock.current = false;
    }
  }, [content, realMode, refreshCollections, replay]);

  const handleDelete = useCallback(async (analysisRunId: string) => {
    if (operationLock.current || !globalThis.confirm(content.confirmations.delete)) {
      return;
    }
    operationLock.current = true;
    activeOperation.current = "delete";
    setNotice(null);
    try {
      const result = await deleteAnalysis.execute({ analysisRunId });
      if (result) {
        activeOperation.current = null;
        if (selectedAnalysisRunId === analysisRunId) {
          setSelectedAnalysisRunId(null);
          setInspectorView("details");
        }
        setNotice({ kind: "success", message: content.feedback.deleteSuccess });
        refreshCollections();
      }
    } finally {
      operationLock.current = false;
    }
  }, [content, deleteAnalysis, refreshCollections, selectedAnalysisRunId]);

  const handleNextPage = useCallback(() => {
    const nextCursor = analysisList.data?.cursor.nextCursor;
    if (!nextCursor) {
      return;
    }
    setCursorHistory((items) => [...items, cursor]);
    setCursor(nextCursor);
  }, [analysisList.data?.cursor.nextCursor, cursor]);

  const handlePreviousPage = useCallback(() => {
    setCursorHistory((items) => {
      const previous = items.at(-1);
      setCursor(previous);
      return items.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    const operation = activeOperation.current;
    const resource = operation === "run"
      ? { error: runError, status: runStatus }
      : operation === "replay"
        ? { error: replayError, status: replayStatus }
        : operation === "delete"
          ? { error: deleteError, status: deleteStatus }
          : null;
    if (
      !resource?.error ||
      (resource.status !== "error" &&
        resource.status !== "cancelled")
    ) {
      return;
    }
    activeOperation.current = null;
    setNotice({
      kind:
        resource.error.kind === "cancelled"
          ? "cancelled"
          : "error",
      message: safeErrorMessage(resource.error, content),
    });
  }, [
    content,
    deleteError,
    deleteStatus,
    replayError,
    replayStatus,
    runError,
    runStatus,
  ]);

  const actionBusy = [runAnalysis, replay, deleteAnalysis].some(
    (resource) => resource.status === "loading" || resource.status === "retry",
  );
  const activeMutation = runAnalysis.status === "loading" || runAnalysis.status === "retry"
    ? runAnalysis
    : replay.status === "loading" || replay.status === "retry"
      ? replay
      : deleteAnalysis.status === "loading" || deleteAnalysis.status === "retry"
        ? deleteAnalysis
        : null;

  return (
    <main className={styles.missionControl} lang={locale}>
      <MissionControlHeader
        content={content}
        mode={mode}
        channelTitle={channelContext.channel?.title}
        onRun={() => void handleRun()}
        running={runAnalysis.status === "loading" || runAnalysis.status === "retry"}
      />
      {notice ? (
        <div
          className={styles.notice}
          data-kind={notice.kind}
          role={notice.kind === "error" ? "alert" : "status"}
        >
          {notice.message}
        </div>
      ) : null}
      {activeMutation ? (
        <div aria-live="polite" aria-busy="true" className={styles.operationStatus} role="status">
          <span>{content.states.operationInProgress}</span>
          <Button size="sm" variant="ghost" onClick={activeMutation.cancel}>
            {content.actions.cancel}
          </Button>
        </div>
      ) : null}
      <StatusSummaryGrid content={content} resource={summary} />
      <AnalysisList
        canGoBack={cursorHistory.length > 0}
        content={content}
        locale={locale}
        onDelete={(analysisRunId) => void handleDelete(analysisRunId)}
        onDetails={(analysisRunId) => selectAnalysis(analysisRunId, "details")}
        onHistory={(analysisRunId) => selectAnalysis(analysisRunId, "history")}
        onNextPage={handleNextPage}
        onPreviousPage={handlePreviousPage}
        onReplay={(analysisRunId) => void handleReplay(analysisRunId)}
        resource={analysisList}
        selectedAnalysisRunId={selectedAnalysisRunId}
        selectedDetails={details.data}
      />
      <AnalysisInspector
        actionBusy={actionBusy}
        content={content}
        details={details}
        history={history}
        locale={locale}
        onDelete={(analysisRunId) => void handleDelete(analysisRunId)}
        onReplay={(analysisRunId) => void handleReplay(analysisRunId)}
        onViewChange={setInspectorView}
        selectedAnalysisRunId={selectedAnalysisRunId}
        view={inspectorView}
      />
    </main>
  );
}
