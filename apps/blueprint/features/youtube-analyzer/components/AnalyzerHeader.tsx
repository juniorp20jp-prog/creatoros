import Link from "next/link";

import type { Locale } from "../../../i18n/config";
import type { YouTubeAnalyzerScenarioId } from "../fixtures";
import type { YouTubeAnalyzerUiState } from "../model";
import type {
  YouTubeAnalyzerDictionary,
  YouTubeAnalyzerScenarioOption,
} from "../types";
import { formatAnalyzerDate } from "../formatters";
import { ScenarioSelector } from "./ScenarioSelector";
import styles from "../youtube-analyzer.module.css";

type AnalyzerHeaderProps = {
  channelName: string;
  content: YouTubeAnalyzerDictionary;
  locale: Locale;
  period: { startDate: string; endDate: string } | null;
  scenarioId: YouTubeAnalyzerScenarioId | null;
  scenarios: ReadonlyArray<YouTubeAnalyzerScenarioOption>;
  state: YouTubeAnalyzerUiState;
};

export function AnalyzerHeader({
  channelName,
  content,
  locale,
  period,
  scenarioId,
  scenarios,
  state,
}: AnalyzerHeaderProps) {
  return (
    <header className={styles.analyzerHeader}>
      <div className={styles.headerCopy}>
        <Link className={styles.backLink} href={`/${locale}`}>
          <span aria-hidden="true">←</span>
          {content.header.backToDashboard}
        </Link>
        <p className={styles.eyebrow}>{content.header.eyebrow}</p>
        <h3>{content.header.title}</h3>
        <p className={styles.headerDescription}>{content.header.description}</p>
        <Link
          className={styles.intelligenceLink}
          href={`/${locale}/creator-intelligence${scenarioId ? `?scenario=${scenarioId}` : ""}`}
        >
          {content.header.viewIntelligence}
          <span aria-hidden="true">→</span>
        </Link>
        <p className={styles.demoNotice}>{content.header.demoDataNotice}</p>
      </div>

      <div className={styles.headerControls}>
        <ScenarioSelector
          help={content.header.scenarioHelp}
          label={content.header.scenarioLabel}
          loadingLabel={content.states.loading}
          locale={locale}
          options={scenarios}
          selectedScenarioId={scenarioId}
        />

        <dl className={styles.analysisIdentity}>
          <div>
            <dt>{content.header.channelLabel}</dt>
            <dd>{channelName}</dd>
          </div>
          <div>
            <dt>{content.header.periodLabel}</dt>
            <dd>
              {period
                ? `${formatAnalyzerDate(period.startDate, locale)} – ${formatAnalyzerDate(period.endDate, locale)}`
                : content.overview.notAvailable}
            </dd>
          </div>
          <div>
            <dt>{content.header.statusLabel}</dt>
            <dd className={`${styles.stateBadge} ${styles[state]}`}>
              {content.states[state]}
            </dd>
          </div>
        </dl>
      </div>
    </header>
  );
}
