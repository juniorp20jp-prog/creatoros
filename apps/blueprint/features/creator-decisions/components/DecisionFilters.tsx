import Link from "next/link";
import type { Locale } from "../../../i18n/config";
import type { CreatorDecisionScenarioId } from "../fixtures";
import type { CreatorDecisionDictionary, DecisionFilterViewModel } from "../types";
import styles from "../creator-decisions.module.css";

export function DecisionFilters({ content, filters, locale, scenarioId, mode, analysisRunId }: {
  content: CreatorDecisionDictionary;
  filters: DecisionFilterViewModel;
  locale: Locale;
  scenarioId: CreatorDecisionScenarioId;
  mode: "real" | "demo";
  analysisRunId?: string;
}) {
  return (
    <section aria-labelledby="decision-filters-title" className={styles.filterPanel}>
      <div><h2 id="decision-filters-title">{content.filters.title}</h2><p>{content.filters.description}</p></div>
      <form className={styles.filterForm} method="get">
        {mode === "demo" ? <input name="scenario" type="hidden" value={scenarioId} /> : <input name="mode" type="hidden" value="real" />}
        {analysisRunId ? <input name="analysisRunId" type="hidden" value={analysisRunId} /> : null}
        <label><span>{content.filters.priority}</span><select defaultValue={filters.selected.priority} name="priority">{filters.priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span>{content.filters.category}</span><select defaultValue={filters.selected.category} name="category">{filters.categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <button type="submit">{content.filters.apply}</button>
        <Link href={mode === "real" ? `/${locale}/decisions${analysisRunId ? `?analysisRunId=${encodeURIComponent(analysisRunId)}` : ""}` : `/${locale}/decisions?mode=demo&scenario=${scenarioId}`}>{content.filters.reset}</Link>
      </form>
    </section>
  );
}