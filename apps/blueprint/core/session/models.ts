import type { UserLocale } from "../identity";

export type SessionClientType = "web" | "mobile" | "internal";

/** Closed metadata intentionally excludes arbitrary credentials and provider data. */
export type SessionMetadata = Readonly<{
  clientType: SessionClientType;
  locale?: UserLocale;
}>;

export type Session = Readonly<{
  sessionId: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
  revokedAt?: string;
  metadata: SessionMetadata;
}>;

export type CreateSessionInput = Readonly<{
  sessionId: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  metadata: SessionMetadata;
}>;
