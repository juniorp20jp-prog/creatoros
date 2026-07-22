"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";

import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import fr from "../../../messages/fr.json";
import ptBR from "../../../messages/pt-BR.json";
import {
  defaultLocale,
  isValidLocale,
  type Locale,
} from "../../../i18n/config";
import styles from "../../../features/creator-intelligence/creator-intelligence.module.css";

const routeDictionaries = {
  en,
  es,
  fr,
  "pt-BR": ptBR,
} satisfies Record<Locale, typeof en>;

export default function CreatorIntelligenceRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ locale: string }>();
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  const content = routeDictionaries[locale].blueprint.creatorIntelligence;

  useEffect(() => {
    console.error("Creator Intelligence route error", error);
  }, [error]);

  return (
    <section
      className={`${styles.statePanel} ${styles.errorPanel}`}
      lang={locale}
      role="alert"
    >
      <p className={styles.eyebrow}>{content.states["unexpected-error"]}</p>
      <h2>{content.states.unexpectedTitle}</h2>
      <p>{content.states.unexpectedDescription}</p>
      <button className={styles.retryButton} onClick={reset} type="button">
        {content.states.retry}
      </button>
    </section>
  );
}
