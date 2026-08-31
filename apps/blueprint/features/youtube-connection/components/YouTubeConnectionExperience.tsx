"use client";

import Image from "next/image";
import React, { useMemo, useState } from "react";

import { Button, Card } from "@repo/ui";

import type { Locale } from "../../../i18n/config";
import { YouTubeApiClient, type YouTubeClientErrorKind } from "../client";
import { formatYouTubeCounter, formatYouTubeTimestamp } from "../formatters";
import { useYouTubeConnection } from "../hooks";
import type { YouTubeConnectionDictionary } from "../types";
import styles from "../youtube-connection.module.css";

type YouTubeConnectionExperienceProps = Readonly<{
  content: YouTubeConnectionDictionary;
  locale: Locale;
  client?: YouTubeApiClient;
}>;

export function YouTubeConnectionExperience({
  content,
  locale,
  client,
}: YouTubeConnectionExperienceProps) {
  const defaultClient = useMemo(() => new YouTubeApiClient(), []);
  const apiClient = client ?? defaultClient;
  const controller = useYouTubeConnection(apiClient);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const connectUrl = apiClient.getConnectUrl(locale);
  const loginUrl = `/api/auth/google?returnTo=${encodeURIComponent(`/${locale}/youtube-analyzer`)}`;
  const isConnected = controller.connection?.connected === true;
  const isBusy = controller.operation !== "idle";
  const reconnectRequired = controller.operationError === "authorization";

  return (
    <section aria-labelledby="youtube-connection-title" className={styles.experience}>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>{content.eyebrow}</p>
          <h1 id="youtube-connection-title">{content.title}</h1>
          <p>{content.description}</p>
        </div>
        <span className={styles.realSourceBadge}>{content.realData}</span>
      </div>

      {controller.phase === "loading" ? (
        <Card aria-busy="true" aria-live="polite" className={styles.loadingCard} padding="lg">
          <span className={styles.spinner} aria-hidden="true" />
          <span>{content.loading}</span>
        </Card>
      ) : null}

      {controller.phase === "unauthenticated" ? (
        <Card className={styles.stateCard} padding="lg">
          <p className={styles.stateEyebrow}>{content.authenticationRequired}</p>
          <h2>{content.authenticationTitle}</h2>
          <p>{content.authenticationDescription}</p>
          <a className={styles.primaryLink} href={loginUrl}>{content.signIn}</a>
        </Card>
      ) : null}

      {controller.phase === "error" ? (
        <Card className={styles.stateCard} padding="lg">
          <p className={styles.stateEyebrow}>{content.loadErrorTitle}</p>
          <p role="alert">{errorMessage(content, controller.loadError)}</p>
          <Button onClick={() => void controller.reload()} variant="secondary">{content.retry}</Button>
        </Card>
      ) : null}

      {controller.phase === "ready" && !isConnected ? (
        <Card className={styles.stateCard} padding="lg" variant="highlighted">
          <div className={styles.stateIcon} aria-hidden="true">▶</div>
          <p className={styles.stateEyebrow}>{content.notConnected}</p>
          <h2>{content.notConnectedTitle}</h2>
          <p>{content.notConnectedDescription}</p>
          <a className={styles.primaryLink} href={connectUrl}>{content.connect}</a>
        </Card>
      ) : null}

      {controller.phase === "ready" && isConnected ? (
        <Card className={styles.channelCard} padding="none" variant="elevated">
          <div className={styles.channelHero}>
            <div className={styles.channelIdentity}>
              {controller.channel?.thumbnailUrl ? (
                <Image
                  alt={`${controller.channel.title} — ${content.channelAvatar}`}
                  className={styles.avatar}
                  height={88}
                  src={controller.channel.thumbnailUrl}
                  unoptimized
                  width={88}
                />
              ) : (
                <div aria-label={content.channelAvatarUnavailable} className={styles.avatarFallback} role="img">YT</div>
              )}
              <div>
                <div className={styles.connectionLine}>
                  <span className={styles.connectedDot} aria-hidden="true" />
                  <span>{content.connected}</span>
                </div>
                <h2>{controller.channel?.title ?? controller.connection?.channelTitle ?? content.channelFallback}</h2>
                <p>{controller.channel?.handle ?? controller.channel?.customUrl ?? content.handleUnavailable}</p>
              </div>
            </div>
            <div className={styles.actions}>
              <Button
                disabled={isBusy}
                isLoading={controller.operation === "synchronizing"}
                loadingContent={content.synchronizing}
                onClick={() => void controller.synchronize()}
              >
                {controller.channel ? content.synchronize : content.firstSync}
              </Button>
              {reconnectRequired ? (
                <a className={styles.secondaryLink} href={connectUrl}>{content.reconnect}</a>
              ) : null}
              <Button
                disabled={isBusy}
                onClick={() => setConfirmingDisconnect(true)}
                variant="danger"
              >
                {content.disconnect}
              </Button>
            </div>
          </div>

          {controller.channel ? (
            <div className={styles.channelBody}>
              <dl className={styles.metricGrid}>
                <div>
                  <dt>{content.subscribers}</dt>
                  <dd>{controller.channel.hiddenSubscriberCount ? content.hidden : formatYouTubeCounter(controller.channel.subscriberCount, locale, content.unavailable)}</dd>
                </div>
                <div>
                  <dt>{content.views}</dt>
                  <dd>{formatYouTubeCounter(controller.channel.viewCount, locale, content.unavailable)}</dd>
                </div>
                <div>
                  <dt>{content.videos}</dt>
                  <dd>{formatYouTubeCounter(controller.channel.videoCount, locale, content.unavailable)}</dd>
                </div>
              </dl>
              <div className={styles.syncSummary}>
                <div>
                  <span>{content.lastSync}</span>
                  <strong>{formatYouTubeTimestamp(controller.channel.lastSyncedAt, locale, content.unavailable)}</strong>
                </div>
                <div>
                  <span>{content.syncStatus}</span>
                  <strong>{content.synchronized}</strong>
                </div>
              </div>
              {controller.channel.description ? <p className={styles.channelDescription}>{controller.channel.description}</p> : null}
            </div>
          ) : (
            <div className={styles.pendingSync}>
              <strong>{content.pendingFirstSync}</strong>
              <p>{content.pendingFirstSyncDescription}</p>
            </div>
          )}

          <div aria-atomic="true" aria-live="polite" className={styles.operationNotice}>
            {controller.operation === "synchronizing" ? content.syncInProgress : null}
            {controller.lastOutcome === "completed" ? content.syncCompleted : null}
            {controller.lastOutcome === "no-change" ? content.noChange : null}
            {controller.operationError ? <span role="alert">{errorMessage(content, controller.operationError)}</span> : null}
          </div>

          {confirmingDisconnect ? (
            <div aria-describedby="youtube-disconnect-description" aria-labelledby="youtube-disconnect-title" className={styles.confirmation} role="alertdialog">
              <div>
                <strong id="youtube-disconnect-title">{content.disconnectConfirmTitle}</strong>
                <p id="youtube-disconnect-description">{content.disconnectConfirmDescription}</p>
              </div>
              <div className={styles.confirmationActions}>
                <Button onClick={() => setConfirmingDisconnect(false)} variant="secondary">{content.cancel}</Button>
                <Button
                  isLoading={controller.operation === "disconnecting"}
                  loadingContent={content.disconnecting}
                  onClick={() => {
                    setConfirmingDisconnect(false);
                    void controller.disconnect();
                  }}
                  variant="danger"
                >
                  {content.confirmDisconnect}
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}
    </section>
  );
}

function errorMessage(content: YouTubeConnectionDictionary, kind: YouTubeClientErrorKind | null): string {
  if (kind === "unauthenticated") return content.errors.unauthenticated;
  if (kind === "not-connected") return content.errors.notConnected;
  if (kind === "authorization") return content.errors.authorization;
  if (kind === "provider") return content.errors.provider;
  if (kind === "network") return content.errors.network;
  return content.errors.generic;
}
