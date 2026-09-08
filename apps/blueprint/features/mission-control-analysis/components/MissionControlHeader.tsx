import React from "react";
import { Button } from "@repo/ui";

import type { MissionControlContent } from "../types";
import styles from "../mission-control-analysis.module.css";

type MissionControlHeaderProps = {
  content: MissionControlContent;
  running: boolean;
  mode: "real" | "demo";
  channelTitle?: string;
  onRun(): void;
};

export function MissionControlHeader({
  content,
  running,
  mode,
  channelTitle,
  onRun,
}: MissionControlHeaderProps) {
  const realMode = mode === "real";
  return (
    <header className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>{content.header.eyebrow}</p>
        <h1>{content.header.title}</h1>
        <p className={styles.heroDescription}>
          {content.header.description}
        </p>
        <span className={styles.demoBadge}>
          {realMode ? content.header.realMode : content.header.demoMode}
        </span>
        {realMode && channelTitle ? (
          <p className={styles.heroDescription}>{channelTitle}</p>
        ) : null}
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