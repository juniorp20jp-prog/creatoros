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
import styles from "../../../features/creator-decisions/creator-decisions.module.css";

const routeDictionaries = {
  en,
  es,
  fr,
  "pt-BR": ptBR,
} satisfies Record<Locale, typeof en>;

export default function DecisionCenterRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ locale?: string }>();
  const locale =
    params.locale !== undefined && isValidLocale(params.locale)
      ? params.locale
      : defaultLocale;
  const content = routeDictionaries[locale].blueprint.creatorDecisions;

  useEffect(() => {
    console.error("Creator Decision Center route failed", error);
  }, [error]);

  return (
    <section
      aria-labelledby="decision-route-error-title"
      className={styles.statePanel}
      lang={locale}
      role="alert"
    >
      <p className={styles.eyebrow}>{content.states.errorEyebrow}</p>
      <h2 id="decision-route-error-title">{content.states.errorTitle}</h2>
      <p>{content.states.errorDescription}</p>
      <button className={styles.retryButton} onClick={reset} type="button">
        {content.states.retry}
      </button>
    </section>
  );
}

