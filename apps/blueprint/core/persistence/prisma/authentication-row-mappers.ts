import type { Identity, IdentityStatus, User, UserStatus } from "../../identity";
import { SUPPORTED_USER_LOCALES, type UserLocale } from "../../identity";
import type { Session, SessionClientType, SessionMetadata } from "../../session";
import type { IdentityRow, SessionRow, UserRow } from "./generated/client";

const USER_STATUSES: ReadonlyArray<UserStatus> = ["active", "suspended", "disabled"];
const IDENTITY_STATUSES: ReadonlyArray<IdentityStatus> = ["active", "disabled"];
const CLIENT_TYPES: ReadonlyArray<SessionClientType> = ["web", "mobile", "internal"];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mapUserRow(row: UserRow): User | undefined {
  if (!USER_STATUSES.includes(row.status as UserStatus) || !SUPPORTED_USER_LOCALES.includes(row.locale as UserLocale)) return undefined;
  return {
    userId: row.userId,
    email: row.email,
    displayName: row.displayName,
    locale: row.locale as UserLocale,
    timezone: row.timezone,
    status: row.status as UserStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapIdentityRow(row: IdentityRow): Identity | undefined {
  if (!IDENTITY_STATUSES.includes(row.status as IdentityStatus)) return undefined;
  return {
    identityId: row.identityId,
    userId: row.userId,
    status: row.status as IdentityStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapSessionMetadata(value: unknown): SessionMetadata | undefined {
  if (!isRecord(value) || !CLIENT_TYPES.includes(value.clientType as SessionClientType)) return undefined;
  const keys = Object.keys(value);
  if (keys.some((key) => key !== "clientType" && key !== "locale")) return undefined;
  if (value.locale !== undefined && !SUPPORTED_USER_LOCALES.includes(value.locale as UserLocale)) return undefined;
  return {
    clientType: value.clientType as SessionClientType,
    ...(value.locale ? { locale: value.locale as UserLocale } : {}),
  };
}

export function mapSessionRow(row: SessionRow): Session | undefined {
  const metadata = mapSessionMetadata(row.metadata);
  if (!metadata) return undefined;
  return {
    sessionId: row.sessionId,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    lastActivityAt: row.lastActivityAt.toISOString(),
    ...(row.revokedAt ? { revokedAt: row.revokedAt.toISOString() } : {}),
    metadata,
  };
}
