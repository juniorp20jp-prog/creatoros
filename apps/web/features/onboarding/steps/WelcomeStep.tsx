import { Button, Card } from "@repo/ui";

import styles from "../styles/onboarding.module.css";

type WelcomeStepProps = {
  eyebrow: string;
  title: string;
  description: string;
  buttonLabel: string;
  onNext: () => void;
};

export function WelcomeStep({
  eyebrow,
  title,
  description,
  buttonLabel,
  onNext,
}: WelcomeStepProps) {
  return (
    <section className={styles.wrapper}>
      <Card className={styles.card} padding="lg">
        <div
          aria-hidden="true"
          className={styles.logo}
        >
          C
        </div>

        <p className={styles.eyebrow}>
          {eyebrow}
        </p>

        <h2 className={styles.title}>
          {title}
        </h2>

        <p className={styles.description}>
          {description}
        </p>

        <div className={styles.actions}>
          <Button onClick={onNext}>
            {buttonLabel}
          </Button>
        </div>
      </Card>
    </section>
  );
}