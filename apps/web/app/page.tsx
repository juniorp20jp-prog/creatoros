import styles from "./page.module.css";

const metrics = [
  ["Canal conectado", "No conectado"],
  ["Misión de crecimiento", "Sin configurar"],
  ["Estado del análisis", "Pendiente"],
  ["Motor de IA", "Listo para comenzar"],
];

const actions = [
  {
    title: "Conectar canal",
    description: "Vincula tu canal de YouTube para comenzar el análisis.",
  },
  {
    title: "Analizar competidor",
    description:
      "Estudia un canal de referencia y descubre qué impulsa su crecimiento.",
  },
  {
    title: "Generar estrategia",
    description:
      "Recibe un plan de crecimiento personalizado con inteligencia artificial.",
  },
];

export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>AI Growth Operating System</p>
            <h1 className={styles.title}>CreatorOS</h1>
          </div>

          <div className={styles.version}>MVP · v0.1.0</div>
        </header>

        <section className={styles.metricsGrid}>
          {metrics.map(([label, value]) => (
            <article className={styles.metricCard} key={label}>
              <p className={styles.metricLabel}>{label}</p>
              <h2 className={styles.metricValue}>{value}</h2>
            </article>
          ))}
        </section>

        <section className={styles.commandCenter}>
          <div className={styles.commandIntro}>
            <p className={styles.commandLabel}>Creator Command Center</p>

            <h2 className={styles.commandTitle}>
              Convierte datos de YouTube en decisiones de crecimiento.
            </h2>

            <p className={styles.commandDescription}>
              Analiza tu canal, compara competidores y recibe un plan de acción
              claro para crecer de forma estratégica.
            </p>
          </div>

          <div className={styles.actionsGrid}>
            {actions.map((action, index) => (
              <button
                className={`${styles.actionButton} ${
                  index === 0 ? styles.primaryAction : ""
                }`}
                key={action.title}
                type="button"
              >
                <span className={styles.actionStep}>PASO {index + 1}</span>

                <strong className={styles.actionTitle}>{action.title}</strong>

                <span className={styles.actionDescription}>
                  {action.description}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}