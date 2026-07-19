import styles from "./page.module.css";

const navigation = [
  "Mission Control",
  "Mi canal",
  "Competidores",
  "Estrategia IA",
  "Ideas virales",
  "Analíticas",
  "Configuración",
];

const metrics = [
  {
    label: "Canal conectado",
    value: "No conectado",
    detail: "Conecta YouTube para iniciar",
  },
  {
    label: "Misión de crecimiento",
    value: "Sin configurar",
    detail: "Define tu meta y fecha objetivo",
  },
  {
    label: "Estado del análisis",
    value: "Pendiente",
    detail: "Aún no hay datos procesados",
  },
  {
    label: "Motor de IA",
    value: "Preparado",
    detail: "Listo para generar estrategia",
  },
];

const actions = [
  {
    step: "01",
    title: "Conectar canal",
    description:
      "Vincula tu canal de YouTube y comienza a importar métricas.",
  },
  {
    step: "02",
    title: "Definir misión",
    description:
      "Selecciona tu objetivo de crecimiento y la fecha que quieres alcanzar.",
  },
  {
    step: "03",
    title: "Analizar competidor",
    description:
      "Estudia un canal de referencia y descubre sus patrones de éxito.",
  },
];

export default function Home() {
  return (
    <main className={styles.appShell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>C</div>

          <div>
            <p className={styles.brandName}>CreatorOS</p>
            <p className={styles.brandSubtitle}>Growth Intelligence</p>
          </div>
        </div>

        <nav className={styles.navigation}>
          <p className={styles.navigationLabel}>Plataforma</p>

          {navigation.map((item, index) => (
            <button
              className={`${styles.navItem} ${
                index === 0 ? styles.navItemActive : ""
              }`}
              key={item}
              type="button"
            >
              <span className={styles.navDot} />
              {item}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <p className={styles.planLabel}>Plan actual</p>
          <strong className={styles.planName}>CreatorOS MVP</strong>
          <span className={styles.planDetail}>Entorno de desarrollo</span>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <p className={styles.pageEyebrow}>Creator Command Center</p>
            <h1 className={styles.pageTitle}>Mission Control</h1>
          </div>

          <div className={styles.topbarActions}>
            <button className={styles.secondaryButton} type="button">
              Ver actividad
            </button>

            <button className={styles.primaryButton} type="button">
              Conectar YouTube
            </button>

            <div className={styles.avatar}>JP</div>
          </div>
        </header>

        <div className={styles.content}>
          <section className={styles.hero}>
            <div className={styles.heroContent}>
              <p className={styles.heroLabel}>Tu sistema operativo de crecimiento</p>

              <h2 className={styles.heroTitle}>
                Convierte datos de YouTube en decisiones claras.
              </h2>

              <p className={styles.heroDescription}>
                CreatorOS analiza tu canal, estudia competidores y transforma
                cada hallazgo en acciones concretas para acelerar tu crecimiento.
              </p>

              <div className={styles.heroActions}>
                <button className={styles.primaryButton} type="button">
                  Crear mi misión
                </button>

                <button className={styles.secondaryButton} type="button">
                  Explorar plataforma
                </button>
              </div>
            </div>

            <div className={styles.missionCard}>
              <p className={styles.missionCardLabel}>Misión activa</p>
              <h3 className={styles.missionCardTitle}>Sin configurar</h3>

              <div className={styles.progressTrack}>
                <div className={styles.progressValue} />
              </div>

              <div className={styles.missionStats}>
                <div>
                  <span>Progreso</span>
                  <strong>0%</strong>
                </div>

                <div>
                  <span>Probabilidad</span>
                  <strong>—</strong>
                </div>

                <div>
                  <span>Fecha estimada</span>
                  <strong>—</strong>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.metricsGrid}>
            {metrics.map((metric) => (
              <article className={styles.metricCard} key={metric.label}>
                <p className={styles.metricLabel}>{metric.label}</p>
                <h3 className={styles.metricValue}>{metric.value}</h3>
                <p className={styles.metricDetail}>{metric.detail}</p>
              </article>
            ))}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Inicio guiado</p>
                <h2 className={styles.sectionTitle}>Próximas acciones</h2>
              </div>

              <span className={styles.sectionStatus}>0 de 3 completadas</span>
            </div>

            <div className={styles.actionsGrid}>
              {actions.map((action, index) => (
                <article
                  className={`${styles.actionCard} ${
                    index === 0 ? styles.actionCardFeatured : ""
                  }`}
                  key={action.title}
                >
                  <span className={styles.actionStep}>{action.step}</span>
                  <h3 className={styles.actionTitle}>{action.title}</h3>
                  <p className={styles.actionDescription}>
                    {action.description}
                  </p>

                  <button className={styles.actionLink} type="button">
                    Comenzar →
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}