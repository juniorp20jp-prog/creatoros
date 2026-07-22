import type {
  BlueprintDictionary,
  DashboardData,
} from "../types";
import styles from "../blueprint-dashboard.module.css";

type OperationsPanelProps = {
  content: BlueprintDictionary["dashboard"];
  data: Pick<DashboardData, "activity" | "progress" | "tasks">;
};

export function OperationsPanel({
  content,
  data,
}: OperationsPanelProps) {
  return (
    <div className={styles.operationsGrid}>
      <section
        aria-labelledby="tasks-heading"
        className={styles.panel}
        id="architecture"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>{content.tasks.eyebrow}</p>
            <h2 id="tasks-heading">{content.tasks.title}</h2>
          </div>
          <span>{content.tasks.count}</span>
        </div>

        <ol className={styles.taskList}>
          {data.tasks.map((task, index) => (
            <li key={task.id}>
              <span className={styles.taskIndex} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{content.tasks.items[task.id].title}</h3>
                <p>{content.tasks.items[task.id].detail}</p>
              </div>
              <span className={styles.taskStatus}>
                {content.statuses[task.status]}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="progress-heading"
        className={styles.panel}
        id="roadmap"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>{content.progress.eyebrow}</p>
            <h2 id="progress-heading">{content.progress.title}</h2>
          </div>
          <strong>{data.progress}%</strong>
        </div>
        <p className={styles.panelDescription}>
          {content.progress.description}
        </p>
        <progress
          aria-label={content.progress.ariaLabel}
          className={styles.progressBar}
          max={100}
          value={data.progress}
        />
        <div className={styles.progressLegend}>
          <span>{content.progress.foundation}</span>
          <span>{content.progress.commercial}</span>
        </div>

        <div className={styles.activityBlock} id="decisions">
          <div className={styles.activityHeading}>
            <h3>{content.activity.title}</h3>
            <span>{content.activity.updated}</span>
          </div>
          <ul className={styles.activityList}>
            {data.activity.map((activity) => (
              <li key={activity.id}>
                <span
                  aria-hidden="true"
                  className={`${styles.activityDot} ${styles[activity.tone]}`}
                />
                <div>
                  <p>{content.activity.items[activity.id].title}</p>
                  <span>{content.activity.items[activity.id].time}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
