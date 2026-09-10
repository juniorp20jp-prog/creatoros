import Link from "next/link";
import type { Locale } from "../../../i18n/config";
import type { CreatorDecisionScenarioId } from "../fixtures";
import type { CreatorDecisionDictionary, DecisionSourceViewModel } from "../types";
import styles from "../creator-decisions.module.css";
import { DecisionScenarioSelector } from "./DecisionScenarioSelector";

export function DecisionCenterHeader({ content, count, locale, scenarioId, scenarios, source, mode, analysisRunId }: {
  content: CreatorDecisionDictionary;
  count: number;
  locale: Locale;
  scenarioId: CreatorDecisionScenarioId;
  scenarios: ReadonlyArray<{ id: CreatorDecisionScenarioId; label: string; description: string }>;
  source: DecisionSourceViewModel;
  mode: "real" | "demo";
  analysisRunId?: string;
}) {
  return (
    <header className={styles.decisionHeader}>
      <div className={styles.headerCopy}>
        <Link className={styles.backLink} href={mode === "real" ? `/${locale}/creator-intelligence${analysisRunId ? `?analysisRunId=${encodeURIComponent(analysisRunId)}` : ""}` : `/${locale}`}>← {content.header.backToDashboard}</Link>
        <p className={styles.eyebrow}>{content.header.eyebrow}</p>
        <h2>{content.header.title}</h2>
        <p className={styles.headerDescription}>{content.header.description}</p>
        <div className={styles.headerStatus}><strong>{content.header.activeCount.replace("{count}", String(count))}</strong><span>{mode === "real" ? content.realMode.badge : content.header.demoNotice}</span></div>
      </div>
      <div className={styles.headerControls}>
        {mode === "demo" ? <DecisionScenarioSelector help={content.header.scenarioHelp} label={content.header.scenarioLabel} loadingLabel={content.header.loading} locale={locale} options={scenarios} selectedScenarioId={scenarioId} /> : null}
        <dl className={styles.sourceContext}>
          <div><dt>{content.header.channel}</dt><dd>{source.channelName}</dd></div>
          <div><dt>{content.header.period}</dt><dd>{source.period}</dd></div>
          <div><dt>{content.header.generated}</dt><dd>{source.analysisDate}</dd></div>
          <div><dt>{content.header.sample}</dt><dd>{source.sampleSize}</dd></div>
          <div><dt>{content.header.quality}</dt><dd>{source.qualityLabel}</dd></div>
        </dl>
      </div>
    </header>
  );
}