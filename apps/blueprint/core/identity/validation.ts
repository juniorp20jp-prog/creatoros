import {
  SUPPORTED_USER_LOCALES,
  type CreateIdentityInput,
  type CreateUserInput,
  type Identity,
  type User,
} from "./models";

export type IdentityValidationError = Readonly<{
  code: "invalid-input";
  field: string;
  message: string;
}>;

export type IdentityValidationResult<TValue> =
  | Readonly<{ status: "success"; value: TValue }>
  | Readonly<{ status: "failure"; error: IdentityValidationError }>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function failure(field: string, message: string): IdentityValidationResult<never> {
  return { status: "failure", error: { code: "invalid-input", field, message } };
}

function canonicalTimestamp(value: string): string | undefined {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) || date.toISOString() !== value ? undefined : value;
}

function isTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createUser(input: CreateUserInput): IdentityValidationResult<User> {
  const userId = input.userId.trim();
  if (!userId) return failure("userId", "User identifier is required.");
  const email = normalizeEmail(input.email);
  if (!EMAIL_PATTERN.test(email)) return failure("email", "Email is invalid.");
  const displayName = input.displayName.trim();
  if (!displayName) return failure("displayName", "Display name is required.");
  if (!SUPPORTED_USER_LOCALES.includes(input.locale)) return failure("locale", "Locale is not supported.");
  const timezone = input.timezone.trim();
  if (!isTimezone(timezone)) return failure("timezone", "Timezone is invalid.");
  const createdAt = canonicalTimestamp(input.createdAt);
  if (!createdAt) return failure("createdAt", "Created timestamp must be canonical ISO-8601.");

  return { status: "success", value: { userId, email, displayName, locale: input.locale, timezone, createdAt, updatedAt: createdAt, status: input.status ?? "active" } };
}

export function createIdentity(input: CreateIdentityInput): IdentityValidationResult<Identity> {
  const identityId = input.identityId.trim();
  if (!identityId) return failure("identityId", "Identity identifier is required.");
  const userId = input.userId.trim();
  if (!userId) return failure("userId", "User identifier is required.");
  const createdAt = canonicalTimestamp(input.createdAt);
  if (!createdAt) return failure("createdAt", "Created timestamp must be canonical ISO-8601.");
  return { status: "success", value: { identityId, userId, status: input.status ?? "active", createdAt, updatedAt: createdAt } };
}
