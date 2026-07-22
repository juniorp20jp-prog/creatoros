"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { Locale } from "../../../i18n/config";
import type {
  YouTubeAnalyzerScenarioId,
} from "../fixtures";
import type { YouTubeAnalyzerScenarioOption } from "../types";
import styles from "../youtube-analyzer.module.css";

type ScenarioSelectorProps = {
  help: string;
  label: string;
  loadingLabel: string;
  locale: Locale;
  options: ReadonlyArray<YouTubeAnalyzerScenarioOption>;
  selectedScenarioId: YouTubeAnalyzerScenarioId | null;
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
      router.push(`/${locale}/youtube-analyzer?scenario=${value}`);
    });
  }

  return (
    <div className={styles.scenarioControl}>
      <label htmlFor="youtube-analyzer-scenario">{label}</label>
      <select
        aria-describedby="youtube-analyzer-scenario-help"
        disabled={isPending}
        id="youtube-analyzer-scenario"
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
      <span id="youtube-analyzer-scenario-help">
        {
          options.find((option) => option.id === selectedScenarioId)
            ?.description ?? help
        }
      </span>
      <span aria-live="polite" className={styles.pendingStatus}>
        {isPending ? loadingLabel : ""}
      </span>
    </div>
  );
}
