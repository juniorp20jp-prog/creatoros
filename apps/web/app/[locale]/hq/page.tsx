import Link from "next/link";

import {
  getLocalizedHqHref,
  hqNavigationItems,
} from "../../../features/hq/lib/navigation";

import styles from "./hq.module.css";

interface HqPageProps {
  params: Promise<{
    locale: string;
  }>;
}

const metrics = [
  {
    label: "Constitución",
    value: "v1.0",
    detail: "Principios fundamentales definidos",
    status: "Aprobada",
  },
  {
    label: "Master Blueprint",
    value: "v1.0",
    detail: "Arquitectura estratégica inicial",
    status: "Activo",
  },
  {
    label: "Investigaciones CSI",
    value: "12",
    detail: "Estudios estratégicos completados",
    status: "Actualizado",
  },
  {
    label: "Progreso del roadmap",
    value: "38%",
    detail: "Construcción inicial de CreatorOS",
    status: "En curso",
  },
];

const recentActivity = [
  {
    title: "CreatorOS HQ iniciado",
    description: "Se creó la arquitectura principal del centro estratégico.",
    date: "Hoy",
  },
  {
    title: "CSI-012 completado",
    description:
      "Se definió la estrategia de valor, monetización e inteligencia premium.",
    date: "Reciente",
  },
  {
    title: "Constitución v1.0 definida",
    description:
      "La visión, misión y principios centrales de CreatorOS fueron establecidos.",
    date: "Reciente",
  },
  {
    title: "Master Blueprint estructurado",
    description:
      "Se organizaron los motores, módulos y fundamentos de la plataforma.",
    date: "Reciente",
  },
];

const strategicAlerts = [
  {
    level: "warning",
    title: "Contenido pendiente",
    description:
      "Las páginas internas todavía necesitan recibir su contenido oficial.",
  },
  {
    level: "info",
    title: "Sprint actual",
    description:
      "CreatorOS HQ se encuentra en su primera fase de implementación.",
  },
  {
    level: "success",
    title: "Arquitectura preparada",
    description:
      "La estructura de rutas, navegación, contenido y tipos ya está organizada.",
  },
];

export default async function HqPage({ params }: HqPageProps) {
  const { locale } = await params;

  const documentLinks = hqNavigationItems.filter((item) => item.id !== "hq");

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>CREATOROS INTELLIGENCE CENTER</span>

          <h1>CreatorOS HQ</h1>

          <p>
            El centro estratégico donde viven la visión, arquitectura,
            investigaciones, decisiones y evolución de CreatorOS.
          </p>

          <div className={styles.heroMeta}>
            <div>
              <span>Sprint actual</span>
              <strong>Sprint 9</strong>
            </div>

            <div>
              <span>Estado general</span>
              <strong>En desarrollo</strong>
            </div>

            <div>
              <span>Arquitectura</span>
              <strong>Preparada</strong>
            </div>
          </div>
        </div>

        <div className={styles.heroBadge}>
          <span>Estado del sistema</span>
          <strong>Operativo</strong>
          <small>La base de HQ está lista para implementación.</small>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionEyebrow}>RESUMEN EJECUTIVO</span>
            <h2>Estado estratégico</h2>
          </div>

          <p>
            Una vista rápida del progreso documental y estratégico del
            proyecto.
          </p>
        </div>

        <div className={styles.metricsGrid}>
          {metrics.map((metric) => (
            <article className={styles.metricCard} key={metric.label}>
              <div className={styles.metricTop}>
                <span>{metric.label}</span>
                <span className={styles.statusBadge}>{metric.status}</span>
              </div>

              <strong className={styles.metricValue}>{metric.value}</strong>
              <p>{metric.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionEyebrow}>DOCUMENTACIÓN VIVA</span>
            <h2>Áreas de inteligencia</h2>
          </div>

          <p>
            Accede a los documentos que dirigen la construcción de CreatorOS.
          </p>
        </div>

        <div className={styles.documentsGrid}>
          {documentLinks.map((item, index) => (
            <Link
              className={styles.documentCard}
              href={getLocalizedHqHref(locale, item.href)}
              key={item.id}
            >
              <div className={styles.documentNumber}>
                {String(index + 1).padStart(2, "0")}
              </div>

              <div className={styles.documentContent}>
                <h3>{item.label}</h3>
                <p>{item.description}</p>
              </div>

              <span className={styles.documentArrow} aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className={styles.contentGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.sectionEyebrow}>HISTORIAL</span>
              <h2>Actividad reciente</h2>
            </div>

            <span className={styles.panelIndicator}>4 actualizaciones</span>
          </div>

          <div className={styles.activityList}>
            {recentActivity.map((activity) => (
              <article className={styles.activityItem} key={activity.title}>
                <div className={styles.activityMarker} />

                <div className={styles.activityContent}>
                  <div className={styles.activityHeading}>
                    <h3>{activity.title}</h3>
                    <time>{activity.date}</time>
                  </div>

                  <p>{activity.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.sectionEyebrow}>ATENCIÓN</span>
              <h2>Alertas estratégicas</h2>
            </div>
          </div>

          <div className={styles.alertList}>
            {strategicAlerts.map((alert) => (
              <article
                className={`${styles.alertItem} ${
                  styles[
                    `alert${alert.level.charAt(0).toUpperCase()}${alert.level.slice(
                      1,
                    )}`
                  ]
                }`}
                key={alert.title}
              >
                <div className={styles.alertIcon} aria-hidden="true">
                  {alert.level === "warning"
                    ? "!"
                    : alert.level === "success"
                      ? "✓"
                      : "i"}
                </div>

                <div>
                  <h3>{alert.title}</h3>
                  <p>{alert.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className={styles.quickActions}>
        <div>
          <span className={styles.sectionEyebrow}>PRÓXIMAS ACCIONES</span>
          <h2>Continúa construyendo CreatorOS</h2>
          <p>
            Convierte la estrategia documentada en decisiones, tareas y
            resultados visibles.
          </p>
        </div>

        <div className={styles.actionButtons}>
          <Link
            className={styles.primaryAction}
            href={getLocalizedHqHref(locale, "/hq/csi")}
          >
            Abrir CSI
          </Link>

          <Link
            className={styles.secondaryAction}
            href={getLocalizedHqHref(locale, "/hq/roadmap")}
          >
            Revisar roadmap
          </Link>
        </div>
      </section>
    </main>
  );
}