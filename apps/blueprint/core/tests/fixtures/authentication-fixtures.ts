import type { CreateIdentityInput, CreateUserInput } from "../../identity";
import type { CreateSessionInput } from "../../session";
import type { Clock } from "../../services";

export const AUTH_TEST_TIME = "2026-08-01T12:00:00.000Z";
export const AUTH_TEST_LATER = "2026-08-01T12:30:00.000Z";
export const AUTH_TEST_EXPIRY = "2026-08-01T13:00:00.000Z";

export const userInput: CreateUserInput = {
  userId: "auth_test_user",
  email: "Creator@Example.com",
  displayName: "Creator Test",
  locale: "es",
  timezone: "America/New_York",
  createdAt: AUTH_TEST_TIME,
};

export const identityInput: CreateIdentityInput = {
  identityId: "auth_test_identity",
  userId: userInput.userId,
  createdAt: AUTH_TEST_TIME,
};

export const sessionInput: CreateSessionInput = {
  sessionId: "auth_test_session",
  userId: userInput.userId,
  createdAt: AUTH_TEST_TIME,
  expiresAt: AUTH_TEST_EXPIRY,
  metadata: { clientType: "web", locale: "es" },
};

export class AuthenticationTestClock implements Clock {
  private index = 0;
  constructor(private readonly values: ReadonlyArray<string> = [AUTH_TEST_TIME]) {}
  now(): string {
    const value = this.values[this.index] ?? this.values.at(-1);
    this.index += 1;
    if (!value) throw new Error("AuthenticationTestClock requires a timestamp.");
    return value;
  }
}
