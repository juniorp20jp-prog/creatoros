import { Button } from "@repo/ui";
import { notFound } from "next/navigation";

import { LanguageSwitcher } from "../../components/shared/ui/LanguageSwitcher";
import {
  isValidLocale,
  type Locale,
} from "../../i18n/config";
import { getDictionary } from "../../i18n/dictionaries";

import styles from "./page.module.css";

type PageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function Home({
  params,
}: PageProps) {
  const { locale: localeParam } = await params;

  if (!isValidLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const dictionary = await getDictionary(locale);

  const metrics = [
    {
      id: "channel-connected",
      label: dictionary.dashboard.channelConnected,
      value: dictionary.dashboard.notConnected,
      detail: dictionary.dashboard.connectToStart,
    },
    {
      id: "growth-mission",
      label: dictionary.dashboard.growthMission,
      value: dictionary.dashboard.notConfigured,
      detail: dictionary.dashboard.defineGoalDate,
    },
    {
      id: "analysis-status",
      label: dictionary.dashboard.analysisStatus,
      value: dictionary.dashboard.pending,
      detail: dictionary.dashboard.noProcessedData,
    },
    {
      id: "ai-engine",
      label: dictionary.dashboard.aiEngine,
      value: dictionary.dashboard.ready,
      detail: dictionary.dashboard.readyForStrategy,
    },
  ];

  const actions = [
    {
      id: "connect-channel",
      step: "01",
      title: dictionary.dashboard.connectChannel,
      description:
        dictionary.dashboard.connectChannelDescription,
    },
    {
      id: "define-mission",
      step: "02",
      title: dictionary.dashboard.defineMission,
      description:
        dictionary.dashboard.defineMissionDescription,
    },
    {
      id: "analyze-competitor",
      step: "03",
      title: dictionary.dashboard.analyzeCompetitor,
      description:
        dictionary.dashboard.analyzeCompetitorDescription,
    },
  ];

  return (
    <>
      <header className={styles.topbar}>
        <div>
          <p className={styles.pageEyebrow}>
            {dictionary.dashboard.commandCenter}
          </p>

          <h1 className={styles.pageTitle}>
            {dictionary.dashboard.title}
          </h1>
        </div>

       <div className={styles.topbarActions}>
  <LanguageSwitcher currentLocale={locale} />

  <Button variant="secondary">
    {dictionary.dashboard.viewActivity}
  </Button>

  <Button>
  {dictionary.dashboard.connectYouTube}
</Button>

  <div
    aria-label="Perfil de Junior Perez"
    className={styles.avatar}
    role="img"
  >
    JP
  </div>
</div>
      </header>

      <div className={styles.content}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <p className={styles.heroLabel}>
              {dictionary.dashboard.heroLabel}
            </p>

            <h2 className={styles.heroTitle}>
              {dictionary.dashboard.headline}
            </h2>

            <p className={styles.heroDescription}>
              {dictionary.dashboard.description}
            </p>

            <div className={styles.heroActions}>
              <button
                className={styles.primaryButton}
                type="button"
              >
                {dictionary.dashboard.createMission}
              </button>

              <button
                className={styles.secondaryButton}
                type="button"
              >
                {dictionary.dashboard.explorePlatform}
              </button>
            </div>
          </div>

          <div className={styles.missionCard}>
            <p className={styles.missionCardLabel}>
              {dictionary.dashboard.activeMission}
            </p>

            <h3 className={styles.missionCardTitle}>
              {dictionary.dashboard.notConfigured}
            </h3>

            <div className={styles.progressTrack}>
              <div className={styles.progressValue} />
            </div>

            <div className={styles.missionStats}>
              <div>
                <span>
                  {dictionary.dashboard.progress}
                </span>

                <strong>0%</strong>
              </div>

              <div>
                <span>
                  {dictionary.dashboard.probability}
                </span>

                <strong>—</strong>
              </div>

              <div>
                <span>
                  {dictionary.dashboard.estimatedDate}
                </span>

                <strong>—</strong>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.metricsGrid}>
          {metrics.map((metric) => (
            <article
              className={styles.metricCard}
              key={metric.id}
            >
              <p className={styles.metricLabel}>
                {metric.label}
              </p>

              <h3 className={styles.metricValue}>
                {metric.value}
              </h3>

              <p className={styles.metricDetail}>
                {metric.detail}
              </p>
            </article>
          ))}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>
                {dictionary.dashboard.guidedSetup}
              </p>

              <h2 className={styles.sectionTitle}>
                {dictionary.dashboard.nextActions}
              </h2>
            </div>

            <span className={styles.sectionStatus}>
              {dictionary.dashboard.completedCount}
            </span>
          </div>

          <div className={styles.actionsGrid}>
            {actions.map((action, index) => (
              <article
                className={`${styles.actionCard} ${
                  index === 0
                    ? styles.actionCardFeatured
                    : ""
                }`}
                key={action.id}
              >
                <span className={styles.actionStep}>
                  {action.step}
                </span>

                <h3 className={styles.actionTitle}>
                  {action.title}
                </h3>

                <p className={styles.actionDescription}>
                  {action.description}
                </p>

                <button
                  className={styles.actionLink}
                  type="button"
                >
                  {dictionary.dashboard.start} →
                </button>
              </article>
            ))}
                      </div>
        </section>
      </div>
    </>
  );
}