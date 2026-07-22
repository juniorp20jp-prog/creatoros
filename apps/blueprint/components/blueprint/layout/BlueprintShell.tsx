import type { ReactNode } from "react";

import type { Locale } from "../../../i18n/config";
import type { Dictionary } from "../../../i18n/dictionaries";
import { BLUEPRINT_VERSION } from "../../../features/blueprint-dashboard/data";
import { BlueprintContent } from "./BlueprintContent";
import { BlueprintHeader } from "./BlueprintHeader";
import { BlueprintSidebar } from "./BlueprintSidebar";
import styles from "./blueprint-shell.module.css";

type BlueprintShellProps = {
  children: ReactNode;
  dictionary: Dictionary;
  locale: Locale;
};

export function BlueprintShell({
  children,
  dictionary,
  locale,
}: BlueprintShellProps) {
  return (
    <div className={styles.shell}>
      <BlueprintSidebar
        content={dictionary.blueprint.navigation}
        locale={locale}
      />

      <div className={styles.workspace}>
        <BlueprintHeader
          content={dictionary.blueprint.header}
          locale={locale}
          version={BLUEPRINT_VERSION}
        />

        <BlueprintContent>{children}</BlueprintContent>
      </div>
    </div>
  );
}
