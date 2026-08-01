import React from "react";
import { Button } from "@repo/ui";

import type { AnalysisHookStatus } from "../../analysis-integration";
import type { MissionControlContent } from "../types";
import styles from "../mission-control-analysis.module.css";

type MissionControlStateProps = {
  status: AnalysisHookStatus;
  content: MissionControlContent;
  emptyMessage?: string;
  errorMessage?: string;
  onRetry?: () => void;
  onCancel?: () => void;
};

export function MissionControlState({
  status,
  content,
  emptyMessage,
  errorMessage,
  onRetry,
  onCancel,
}: MissionControlStateProps) {
  if (status === "loading" || status === "retry") {
    return (
      <div
        aria-live="polite"
        aria-busy="true"
        className={styles.statePanel}
        role="status"
      >
        <span aria-hidden="true" className={styles.spinner} />
        <p>
          {status === "retry"
            ? content.states.retrying
            : content.states.loading}
        </p>
        {onCancel ? (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            {content.actions.cancel}
          </Button>
        ) : null}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={styles.statePanel} role="alert">
        <p>{errorMessage ?? content.states.loadError}</p>
        {onRetry ? (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            {content.actions.retry}
          </Button>
        ) : null}
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className={styles.statePanel} role="status">
        <p>{content.states.cancelled}</p>
        {onRetry ? (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            {content.actions.retry}
          </Button>
        ) : null}
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className={styles.statePanel} role="status">
        <p>{emptyMessage ?? content.states.empty}</p>
      </div>
    );
  }

  return null;
}
