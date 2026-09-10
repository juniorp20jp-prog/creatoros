import Link from "next/link";
import type { Locale } from "../../../i18n/config";
import { formatIntelligenceDate } from "../formatters";
import type { CreatorIntelligenceUiState } from "../model";
import type { CreatorIntelligenceDictionary, CreatorIntelligenceScenarioId, CreatorIntelligenceScenarioOption } from "../types";
import { ScenarioSelector } from "./ScenarioSelector";
import styles from "../creator-intelligence.module.css";

type IntelligenceHeaderProps = {
  channelName: string;
  content: CreatorIntelligenceDictionary;
  locale: Locale;
  period: { startDate: string; endDate: string } | null;
  scenarioId: CreatorIntelligenceScenarioId | null;
  scenarios: ReadonlyArray<CreatorIntelligenceScenarioOption>;
  state: CreatorIntelligenceUiState;
  mode: "real" | "demo";
  analysisRunId?: string;
};
export function IntelligenceHeader({ channelName, content, locale, period, scenarioId, scenarios, state, mode, analysisRunId }: IntelligenceHeaderProps) {
  const scenarioQuery = scenarioId ? `?mode=demo&scenario=${scenarioId}` : "?mode=demo";
  const real = mode === "real";
  return (
    <header className={styles.intelligenceHeader}>
      <div className={styles.headerCopy}>
        <Link className={styles.backLink} href={real ? `/${locale}/mission-control` : `/${locale}`}><span aria-hidden="true">←</span>{content.header.backToDashboard}</Link>
        <p className={styles.eyebrow}>{content.header.eyebrow}</p>
        <h2>{content.header.title}</h2>
        <p className={styles.headerDescription}>{content.header.description}</p>
        <div className={styles.headerActions}>
          <Link className={styles.technicalLink} href={real ? `/${locale}/decisions${analysisRunId ? `?analysisRunId=${encodeURIComponent(analysisRunId)}` : ""}` : `/${locale}/youtube-analyzer${scenarioQuery}`}>
            {real ? content.realMode.openDecisions : content.header.viewTechnicalAnalysis}<span aria-hidden="true">→</span>
          </Link>
          <span className={styles.demoNotice} data-mode={mode}>{real ? content.realMode.badge : content.header.demoDataNotice}</span>
        </div>
      </div>
      <div className={styles.headerControls}>
        {!real ? <ScenarioSelector help={content.header.scenarioHelp} label={content.header.scenarioLabel} loadingLabel={content.states.loading} locale={locale} options={scenarios} selectedScenarioId={scenarioId} /> : null}
        <dl className={styles.analysisIdentity}>
          <div><dt>{content.header.channelLabel}</dt><dd>{channelName}</dd></div>
          <div><dt>{content.header.periodLabel}</dt><dd>{period ? `${formatIntelligenceDate(period.startDate, locale)} – ${formatIntelligenceDate(period.endDate, locale)}` : content.common.notAvailable}</dd></div>
          {real && analysisRunId ? <div><dt>{content.realMode.runLabel}</dt><dd>{analysisRunId.slice(0, 12)}…</dd></div> : null}
          <div><dt>{content.header.statusLabel}</dt><dd className={`${styles.stateBadge} ${styles[state]}`}>{content.states[state]}</dd></div>
        </dl>
      </div>
    </header>
  );
}