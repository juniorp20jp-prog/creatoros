import type { ReactNode } from "react";

import styles from "./blueprint-content.module.css";

type BlueprintContentProps = {
  children: ReactNode;
};

export function BlueprintContent({
  children,
}: BlueprintContentProps) {
  return (
    <main className={styles.content}>
      <div className={styles.contentInner}>{children}</div>
    </main>
  );
}