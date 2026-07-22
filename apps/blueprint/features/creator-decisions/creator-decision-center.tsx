import type { Locale } from "../../i18n/config";
import type { CreatorDecisionScenarioId } from "./fixtures";
import type {
  CreatorDecisionCenterViewModel,
  CreatorDecisionDictionary,
} from "./types";
import { DecisionCenterHeader } from "./components/DecisionCenterHeader";
import { DecisionFilters } from "./components/DecisionFilters";
import { DecisionList } from "./components/DecisionList";
import { DecisionStatePanel } from "./components/DecisionStates";
import { DecisionSummary } from "./components/DecisionSummary";
import styles from "./creator-decisions.module.css";

export function CreatorDecisionCenter({
  content,
  locale,
  scenarios,
  viewModel,
}: {
  content: CreatorDecisionDictionary;
  locale: Locale;
  scenarios: ReadonlyArray<{
    id: CreatorDecisionScenarioId;
    label: string;
    description: string;
  }>;
  viewModel: CreatorDecisionCenterViewModel;
}) {
  return (
    <div className={styles.decisionCenter} lang={locale}>
      <DecisionCenterHeader
        content={content}
        count={
          viewModel.state === "populated" ? viewModel.totalDecisionCount : 0
        }
        locale={locale}
        scenarioId={viewModel.scenarioId}
        scenarios={scenarios}
        source={viewModel.source}
      />

      {viewModel.state === "populated" ? (
        <div className={styles.decisionContent}>
          <DecisionSummary content={content} summary={viewModel.summary} />
          <DecisionFilters
            content={content}
            filters={viewModel.filters}
            locale={locale}
            scenarioId={viewModel.scenarioId}
          />
          <DecisionList
            content={content}
            decisions={viewModel.decisions}
            total={viewModel.totalDecisionCount}
          />
        </div>
      ) : (
        <DecisionStatePanel content={content} state={viewModel.state} />
      )}
    </div>
  );
}

