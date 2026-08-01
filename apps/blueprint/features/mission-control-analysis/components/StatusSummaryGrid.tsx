import React from "react";
import { Card } from "@repo/ui";

import type {
  AnalysisQueryHookResult,
  AnalysisReadStatus,
  AnalysisStatusSummary,
} from "../../analysis-integration";
import { safeErrorMessage } from "../formatters";
import type { MissionControlContent } from "../types";
import { MissionControlState } from "./MissionControlState";
import styles from "../mission-control-analysis.module.css";

const statuses = [
  "completed",
  "partial",
  "failed",
  "processing",
  "pending",
] as const satisfies ReadonlyArray<AnalysisReadStatus>;

type StatusSummaryGridProps = {
  content: MissionControlContent;
  resource: AnalysisQueryHookResult<AnalysisStatusSummary>;
};

export function StatusSummaryGrid({
  content,
  resource,
}: StatusSummaryGridProps) {
  return (
    <section aria-labelledby="mission-status-title" className={styles.section}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>{content.summary.eyebrow}</p>
          <h2 id="mission-status-title">{content.summary.title}</h2>
          <p>{content.summary.description}</p>
        </div>
        {resource.data ? (
          <span className={styles.totalBadge}>
            {content.summary.total}: {resource.data.total}
          </span>
        ) : null}
      </div>
      {resource.status === "success" || resource.status === "empty" ? (
        <div className={styles.statusGrid}>
          {statuses.map((status) => (
            <Card
              className={styles.statusCard}
              data-status={status}
              key={status}
              padding="md"
            >
              <div className={styles.statusCardHeader}>
                <span aria-hidden="true" className={styles.statusDot} />
                <span>{content.status[status].label}</span>
              </div>
              <strong>{resource.data?.counts[status] ?? 0}</strong>
              <p>{content.status[status].description}</p>
            </Card>
          ))}
        </div>
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
