import type { Locale } from "../../i18n/config";
import type { Dictionary } from "../../i18n/dictionaries";
import { dashboardData } from "./data";
import { DashboardHero } from "./components/DashboardHero";
import { MetricGrid } from "./components/MetricGrid";
import { ModuleGrid } from "./components/ModuleGrid";
import { OperationsPanel } from "./components/OperationsPanel";
import styles from "./blueprint-dashboard.module.css";

type BlueprintDashboardProps = {
  dictionary: Dictionary;
  locale: Locale;
};

export function BlueprintDashboard({
  dictionary,
  locale,
}: BlueprintDashboardProps) {
  const content = dictionary.blueprint;

  return (
    <div className={styles.dashboard} id="overview">
      <DashboardHero
        content={content.dashboard}
        version={dashboardData.version}
      />
      <MetricGrid
        content={content.dashboard}
        metrics={dashboardData.metrics}
      />
      <OperationsPanel content={content.dashboard} data={dashboardData} />
      <ModuleGrid content={content} locale={locale} />
    </div>
  );
}
