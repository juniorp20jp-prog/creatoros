import type {
  CreatorDecisionCenterViewModel,
  CreatorDecisionDictionary,
} from "../types";
import styles from "../creator-decisions.module.css";

export function DecisionStatePanel({
  content,
  state,
}: {
  content: CreatorDecisionDictionary;
  state: CreatorDecisionCenterViewModel["state"];
}) {
  const copy =
    state === "empty"
      ? {
          eyebrow: content.states.emptyEyebrow,
          title: content.states.emptyTitle,
          description: content.states.emptyDescription,
        }
      : state === "insufficient-data"
        ? {
            eyebrow: content.states.insufficientEyebrow,
            title: content.states.insufficientTitle,
            description: content.states.insufficientDescription,
          }
        : state === "validation-error"
          ? {
              eyebrow: content.states.validationEyebrow,
              title: content.states.validationTitle,
              description: content.states.validationDescription,
            }
          : {
              eyebrow: content.states.errorEyebrow,
              title: content.states.errorTitle,
              description: content.states.errorDescription,
            };

  return (
    <section aria-labelledby="decision-state-title" className={styles.statePanel} role={state.includes("error") ? "alert" : "status"}>
      <p className={styles.eyebrow}>{copy.eyebrow}</p>
      <h2 id="decision-state-title">{copy.title}</h2>
      <p>{copy.description}</p>
    </section>
  );
}

