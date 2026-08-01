import React from "react";
import { Button, Card } from "@repo/ui";

import type {
  AnalysisDetails,
  AnalysisHistory,
  AnalysisQueryHookResult,
} from "../../analysis-integration";
import type { Locale } from "../../../i18n/config";
import {
  formatAnalysisRunReference,
  formatMissionControlDate,
  formatMissionControlNumber,
  safeErrorMessage,
  statusLabel,
} from "../formatters";
import type { MissionControlContent } from "../types";
import { MissionControlState } from "./MissionControlState";
import styles from "../mission-control-analysis.module.css";

export type InspectorView = "details" | "history";

type AnalysisInspectorProps = {
  content: MissionControlContent;
  locale: Locale;
  selectedAnalysisRunId: string | null;
  view: InspectorView;
  details: AnalysisQueryHookResult<AnalysisDetails>;
  history: AnalysisQueryHookResult<AnalysisHistory>;
  actionBusy: boolean;
  onViewChange(view: InspectorView): void;
  onReplay(analysisRunId: string): void;
  onDelete(analysisRunId: string): void;
};

export function AnalysisInspector({
  content,
  locale,
  selectedAnalysisRunId,
  view,
  details,
  history,
  actionBusy,
  onViewChange,
  onReplay,
  onDelete,
}: AnalysisInspectorProps) {
  return (
    <section aria-labelledby="analysis-inspector-title" className={styles.section}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>{content.inspector.eyebrow}</p>
          <h2 id="analysis-inspector-title">{content.inspector.title}</h2>
          <p>{content.inspector.description}</p>
        </div>
      </div>
      {selectedAnalysisRunId === null ? (
        <Card padding="lg">
          <div className={styles.statePanel} role="status">
            <p>{content.inspector.noSelection}</p>
          </div>
        </Card>
      ) : (
        <Card className={styles.inspectorCard} padding="none">
          <div aria-label={content.inspector.tabsLabel} className={styles.tabList} role="tablist">
            <button
              aria-controls="analysis-details-panel"
              aria-selected={view === "details"}
              className={styles.tabButton}
              id="analysis-details-tab"
              onClick={() => onViewChange("details")}
              role="tab"
              type="button"
            >
              {content.actions.details}
            </button>
            <button
              aria-controls="analysis-history-panel"
              aria-selected={view === "history"}
              className={styles.tabButton}
              id="analysis-history-tab"
              onClick={() => onViewChange("history")}
              role="tab"
              type="button"
            >
              {content.actions.history}
            </button>
          </div>
          {view === "details" ? (
            <div
              aria-labelledby="analysis-details-tab"
              className={styles.inspectorPanel}
              id="analysis-details-panel"
              role="tabpanel"
              tabIndex={0}
            >
              <AnalysisDetailsContent
                content={content}
                locale={locale}
                resource={details}
              />
            </div>
          ) : (
            <div
              aria-labelledby="analysis-history-tab"
              className={styles.inspectorPanel}
              id="analysis-history-panel"
              role="tabpanel"
              tabIndex={0}
            >
              <AnalysisHistoryContent
                content={content}
                correlationId={details.data?.correlationId ?? null}
                locale={locale}
                resource={history}
              />
            </div>
          )}
          <div className={styles.inspectorActions}>
            <Button
              disabled={actionBusy}
              variant="secondary"
              onClick={() => onReplay(selectedAnalysisRunId)}
            >
              {content.actions.replay}
            </Button>
            <Button
              disabled={actionBusy}
              variant="danger"
              onClick={() => onDelete(selectedAnalysisRunId)}
            >
              {content.actions.delete}
            </Button>
          </div>
        </Card>
      )}
    </section>
  );
}

function AnalysisDetailsContent({
  content,
  locale,
  resource,
}: {
  content: MissionControlContent;
  locale: Locale;
  resource: AnalysisQueryHookResult<AnalysisDetails>;
}) {
  if (resource.status !== "success" || !resource.data) {
    return (
      <MissionControlState
        content={content}
        errorMessage={safeErrorMessage(resource.error, content)}
        onCancel={resource.cancel}
        onRetry={resource.retry}
        status={resource.status}
      />
    );
  }
  const { analysisResult, summary } = resource.data;
  return (
    <div className={styles.detailsContent}>
      <div className={styles.detailHeader}>
        <div>
          <span className={styles.statusPill} data-status={summary.status}>
            {statusLabel(summary.status, content)}
          </span>
          <h3>{analysisResult?.channel.name ?? summary.channelId}</h3>
          <p>{formatAnalysisRunReference(summary.analysisRunId)}</p>
        </div>
      </div>
      <dl className={styles.metadataGrid}>
        <Metadata label={content.details.status} value={statusLabel(summary.status, content)} />
        <Metadata label={content.details.channel} value={summary.channelId} />
        <Metadata label={content.details.attempt} value={String(summary.attempt)} />
        <Metadata label={content.details.created} value={formatMissionControlDate(summary.createdAt, locale, content.common.notAvailable)} />
        <Metadata label={content.details.updated} value={formatMissionControlDate(summary.updatedAt, locale, content.common.notAvailable)} />
        <Metadata label={content.details.completed} value={formatMissionControlDate(summary.completedAt, locale, content.common.notAvailable)} />
        <Metadata
          label={content.details.replayRelationship}
          value={summary.retryOfAnalysisRunId
            ? formatAnalysisRunReference(summary.retryOfAnalysisRunId)
            : content.details.originalRun}
        />
        <Metadata label={content.details.correlation} value={resource.data.correlationId ?? content.common.notAvailable} />
      </dl>
      {analysisResult ? (
        <>
          <section aria-labelledby="analysis-scores-title" className={styles.detailSection}>
            <h3 id="analysis-scores-title">{content.details.scores}</h3>
            <div className={styles.scoreGrid}>
              {analysisResult.scores.map((score) => (
                <div key={score.kind}>
                  <span>{content.scoreKinds[score.kind]}</span>
                  <strong>
                    {score.availability === "calculated"
                      ? formatMissionControlNumber(score.value, locale)
                      : content.details.insufficientData}
                  </strong>
                </div>
              ))}
            </div>
          </section>
          <section aria-labelledby="analysis-opportunities-title" className={styles.detailSection}>
            <h3 id="analysis-opportunities-title">{content.details.opportunities}</h3>
            {analysisResult.opportunities.length === 0 ? (
              <p>{content.common.none}</p>
            ) : (
              <ul className={styles.detailList}>
                {analysisResult.opportunities.map((opportunity) => (
                  <li key={opportunity.id}>
                    <strong>{opportunityLabel(opportunity.code, content)}</strong>
                    <span>{content.impacts[opportunity.impact]}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="analysis-recommendations-title" className={styles.detailSection}>
            <h3 id="analysis-recommendations-title">{content.details.recommendations}</h3>
            {analysisResult.recommendations.length === 0 ? (
              <p>{content.common.none}</p>
            ) : (
              <ul className={styles.detailList}>
                {analysisResult.recommendations.map((recommendation) => (
                  <li key={recommendation.id}>
                    <strong>{recommendationLabel(recommendation.actionCode, content)}</strong>
                    <span>{content.impacts[recommendation.priority]}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="analysis-warnings-title" className={styles.detailSection}>
            <h3 id="analysis-warnings-title">{content.details.warnings}</h3>
            <p>{content.details.warningCount.replace("{count}", String(summary.warningCount))}</p>
            {analysisResult.limitations.length === 0 ? (
              <p>{content.common.none}</p>
            ) : (
              <ul className={styles.bulletList}>
                {analysisResult.limitations.map((limitation) => (
                  <li key={limitation}>
                    {limitationLabel(limitation, content)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <div className={styles.statePanel} role="status">
          <p>{content.details.analysisUnavailable}</p>
        </div>
      )}
    </div>
  );
}

function AnalysisHistoryContent({
  content,
  correlationId,
  locale,
  resource,
}: {
  content: MissionControlContent;
  correlationId: string | null;
  locale: Locale;
  resource: AnalysisQueryHookResult<AnalysisHistory>;
}) {
  if (resource.status !== "success" || !resource.data) {
    return (
      <MissionControlState
        content={content}
        emptyMessage={content.history.empty}
        errorMessage={safeErrorMessage(resource.error, content)}
        onCancel={resource.cancel}
        onRetry={resource.retry}
        status={resource.status}
      />
    );
  }
  return (
    <div className={styles.historyContent}>
      <div className={styles.historyHeader}>
        <h3>{content.history.title}</h3>
        <span>{content.details.correlation}: {correlationId ?? content.common.notAvailable}</span>
      </div>
      <ol className={styles.timeline}>
        {resource.data.items.map((item) => (
          <li key={item.analysisRunId}>
            <span aria-hidden="true" className={styles.timelineMarker} />
            <div>
              <div className={styles.timelineTitle}>
                <strong>{item.retryOfAnalysisRunId ? content.history.replay : content.history.original}</strong>
                <span className={styles.statusPill} data-status={item.status}>
                  {statusLabel(item.status, content)}
                </span>
              </div>
              <dl className={styles.timelineMetadata}>
                <Metadata label={content.details.attempt} value={String(item.attempt)} />
                <Metadata label={content.history.date} value={formatMissionControlDate(item.createdAt, locale, content.common.notAvailable)} />
                <Metadata
                  label={content.history.retryOf}
                  value={item.retryOfAnalysisRunId
                    ? formatAnalysisRunReference(item.retryOfAnalysisRunId)
                    : content.common.notAvailable}
                />
              </dl>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function opportunityLabel(
  code: "improve-data-coverage" | "stabilize-publishing-cadence" | "review-low-reach-content",
  content: MissionControlContent,
): string {
  switch (code) {
    case "improve-data-coverage":
      return content.opportunities.improveDataCoverage;
    case "stabilize-publishing-cadence":
      return content.opportunities.stabilizePublishingCadence;
    case "review-low-reach-content":
      return content.opportunities.reviewLowReachContent;
  }
}

function recommendationLabel(
  actionCode: string,
  content: MissionControlContent,
): string {
  switch (actionCode) {
    case "collect-missing-channel-metrics":
      return content.recommendations.collectMissingMetrics;
    case "define-repeatable-publishing-cadence":
      return content.recommendations.definePublishingCadence;
    case "review-content-with-low-subscriber-reach":
      return content.recommendations.reviewLowReachContent;
    default:
      return content.recommendations.availableAction;
  }
}

function limitationLabel(
  limitation: string,
  content: MissionControlContent,
): string {
  switch (limitation) {
    case "deterministic-foundation-no-external-analysis":
      return content.limitations.deterministicFoundation;
    case "no-videos-provided":
      return content.limitations.noVideos;
    case "engagement-data-unavailable":
      return content.limitations.engagementUnavailable;
    case "publishing-consistency-unavailable":
      return content.limitations.publishingUnavailable;
    case "subscriber-reach-unavailable":
      return content.limitations.subscriberReachUnavailable;
    default:
      return content.limitations.other;
  }
}
