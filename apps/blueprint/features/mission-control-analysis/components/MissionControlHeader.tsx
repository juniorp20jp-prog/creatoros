import React from "react";
import { Button } from "@repo/ui";

import type { MissionControlContent } from "../types";
import styles from "../mission-control-analysis.module.css";

type MissionControlHeaderProps = {
  content: MissionControlContent;
  running: boolean;
  onRun(): void;
};

export function MissionControlHeader({
  content,
  running,
  onRun,
}: MissionControlHeaderProps) {
  return (
    <header className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>{content.header.eyebrow}</p>
        <h1>{content.header.title}</h1>
        <p className={styles.heroDescription}>
          {content.header.description}
        </p>
        <span className={styles.demoBadge}>
          {content.header.demoMode}
        </span>
      </div>
      <Button
        isLoading={running}
        loadingContent={content.header.running}
        onClick={onRun}
        size="lg"
      >
        {content.header.runAnalysis}
      </Button>
    </header>
  );
}
