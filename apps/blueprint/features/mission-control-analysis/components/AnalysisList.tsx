import React from "react";
import { Button, Card } from "@repo/ui";

import type {
  AnalysisDetails,
  AnalysisQueryHookResult,
  AnalysisSummary,
  PaginationResult,
} from "../../analysis-integration";
import type { Locale } from "../../../i18n/config";
import {
  formatAnalysisRunReference,
  formatMissionControlDate,
  formatMissionControlNumber,
  getPrimaryScore,
  safeErrorMessage,
  statusLabel,
} from "../formatters";
import type { MissionControlContent } from "../types";
import { MissionControlState } from "./MissionControlState";
import styles from "../mission-control-analysis.module.css";

type AnalysisListProps = {
  content: MissionControlContent;
  locale: Locale;
  resource: AnalysisQueryHookResult<PaginationResult<AnalysisSummary>>;
  selectedAnalysisRunId: string | null;
  selectedDetails: AnalysisDetails | null;
  canGoBack: boolean;
  onPreviousPage(): void;
  onNextPage(): void;
  onDetails(analysisRunId: string): void;
  onHistory(analysisRunId: string): void;
  onReplay(analysisRunId: string): void;
  onDelete(analysisRunId: string): void;
};

export function AnalysisList({
  content,
  locale,
  resource,
  selectedAnalysisRunId,
  selectedDetails,
  canGoBack,
  onPreviousPage,
  onNextPage,
  onDetails,
  onHistory,
  onReplay,
  onDelete,
}: AnalysisListProps) {
  const items = resource.data?.items ?? [];
  const hasItems = items.length > 0;
  return (
    <section aria-labelledby="analysis-list-title" className={styles.section}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>{content.list.eyebrow}</p>
          <h2 id="analysis-list-title">{content.list.title}</h2>
          <p>{content.list.description}</p>
        </div>
      </div>
      {resource.status === "success" && hasItems ? (
        <>
          <div className={styles.tableViewport} tabIndex={0}>
            <table className={styles.analysisTable}>
              <caption className={styles.visuallyHidden}>
                {content.list.caption}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{content.list.columns.run}</th>
                  <th scope="col">{content.list.columns.status}</th>
                  <th scope="col">{content.list.columns.channel}</th>
                  <th scope="col">{content.list.columns.created}</th>
                  <th scope="col">{content.list.columns.attempt}</th>
                  <th scope="col">{content.list.columns.score}</th>
                  <th scope="col">{content.list.columns.actions}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const active = item.analysisRunId === selectedAnalysisRunId;
                  const primaryScore = active
                    ? getPrimaryScore(selectedDetails)
                    : null;
                  const reference = formatAnalysisRunReference(
                    item.analysisRunId,
                  );
                  return (
                    <tr aria-current={active ? "true" : undefined} key={item.analysisRunId}>
                      <td data-label={content.list.columns.run}>
                        <span className={styles.runReference}>{reference}</span>
                      </td>
                      <td data-label={content.list.columns.status}>
                        <span className={styles.statusPill} data-status={item.status}>
                          {statusLabel(item.status, content)}
                        </span>
                      </td>
                      <td data-label={content.list.columns.channel}>{item.channelId}</td>
                      <td data-label={content.list.columns.created}>
                        {formatMissionControlDate(
                          item.createdAt,
                          locale,
                          content.common.notAvailable,
                        )}
                      </td>
                      <td data-label={content.list.columns.attempt}>{item.attempt}</td>
                      <td data-label={content.list.columns.score}>
                        {primaryScore === null
                          ? content.common.notAvailable
                          : formatMissionControlNumber(primaryScore, locale)}
                      </td>
                      <td data-label={content.list.columns.actions}>
                        <div className={styles.rowActions}>
                          <Button size="sm" variant="secondary" onClick={() => onDetails(item.analysisRunId)}>
                            {content.actions.details}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => onHistory(item.analysisRunId)}>
                            {content.actions.history}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => onReplay(item.analysisRunId)}>
                            {content.actions.replay}
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => onDelete(item.analysisRunId)}>
                            {content.actions.delete}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <nav aria-label={content.list.paginationLabel} className={styles.pagination}>
            <Button disabled={!canGoBack} size="sm" variant="secondary" onClick={onPreviousPage}>
              {content.actions.previous}
            </Button>
            <span>{content.list.pageSize}: {resource.data?.pageSize ?? 0}</span>
            <Button
              disabled={!resource.data?.cursor.hasNextPage}
              size="sm"
              variant="secondary"
              onClick={onNextPage}
            >
              {content.actions.next}
            </Button>
          </nav>
        </>
      ) : resource.status === "empty" ? (
        <Card padding="lg">
          <MissionControlState
            content={content}
            emptyMessage={content.states.empty}
            status="empty"
          />
        </Card>
      ) : (
        <MissionControlState
          content={content}
          errorMessage={safeErrorMessage(resource.error, content)}
          onCancel={resource.cancel}
          onRetry={resource.retry}
          status={resource.status}
        />
      )}
    </section>
  );
}
