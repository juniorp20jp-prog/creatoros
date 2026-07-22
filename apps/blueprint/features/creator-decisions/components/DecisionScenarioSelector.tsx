"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { Locale } from "../../../i18n/config";
import type { CreatorDecisionScenarioId } from "../fixtures";
import styles from "../creator-decisions.module.css";

type ScenarioOption = {
  id: CreatorDecisionScenarioId;
  label: string;
  description: string;
};

export function DecisionScenarioSelector({
  help,
  label,
  loadingLabel,
  locale,
  options,
  selectedScenarioId,
}: {
  help: string;
  label: string;
  loadingLabel: string;
  locale: Locale;
  options: ReadonlyArray<ScenarioOption>;
  selectedScenarioId: CreatorDecisionScenarioId;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function selectScenario(value: string): void {
    startTransition(() => {
      router.push(`/${locale}/decisions?scenario=${encodeURIComponent(value)}`);
    });
  }

  return (
    <div className={styles.scenarioControl}>
      <label htmlFor="decision-center-scenario">{label}</label>
      <select
        aria-describedby="decision-center-scenario-help"
        disabled={isPending}
        id="decision-center-scenario"
        onChange={(event) => selectScenario(event.target.value)}
        value={selectedScenarioId}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <span id="decision-center-scenario-help">
        {options.find((option) => option.id === selectedScenarioId)
          ?.description ?? help}
      </span>
      <span aria-live="polite" className={styles.pendingStatus}>
        {isPending ? loadingLabel : ""}
      </span>
    </div>
  );
}

