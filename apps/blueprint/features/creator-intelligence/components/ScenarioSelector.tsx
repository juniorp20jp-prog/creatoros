"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { Locale } from "../../../i18n/config";
import type {
  CreatorIntelligenceScenarioId,
  CreatorIntelligenceScenarioOption,
} from "../types";
import styles from "../creator-intelligence.module.css";

type ScenarioSelectorProps = {
  help: string;
  label: string;
  loadingLabel: string;
  locale: Locale;
  options: ReadonlyArray<CreatorIntelligenceScenarioOption>;
  selectedScenarioId: CreatorIntelligenceScenarioId | null;
};

export function ScenarioSelector({
  help,
  label,
  loadingLabel,
  locale,
  options,
  selectedScenarioId,
}: ScenarioSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function selectScenario(value: string): void {
    startTransition(() => {
      router.push(`/${locale}/creator-intelligence?scenario=${value}`);
    });
  }

  return (
    <div className={styles.scenarioControl}>
      <label htmlFor="creator-intelligence-scenario">{label}</label>
      <select
        aria-describedby="creator-intelligence-scenario-help"
        disabled={isPending}
        id="creator-intelligence-scenario"
        onChange={(event) => selectScenario(event.target.value)}
        value={selectedScenarioId ?? ""}
      >
        <option disabled value="">
          {help}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <span id="creator-intelligence-scenario-help">
        {options.find((option) => option.id === selectedScenarioId)
          ?.description ?? help}
      </span>
      <span aria-live="polite" className={styles.pendingStatus}>
        {isPending ? loadingLabel : ""}
      </span>
    </div>
  );
}
