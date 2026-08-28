import assert from "node:assert/strict";
import { test } from "node:test";

import type { Clock } from "../../../core";
import { YouTubeAuthorizationStateStore, safeYouTubeReturnTo } from "../authorization-state";
import { clearYouTubeStateCookie, youtubeStateCookie } from "../cookies";
import { readYouTubeConfiguration } from "../config";
import { classifyYouTubeTokenExchangeCode, createYouTubeDiagnostic, readSafeYouTubeOAuthCode } from "../youtube-diagnostics";

const NOW = "2026-08-02T12:00:00.000Z";
class TestClock implements Clock { constructor(private readonly value: string) {} now(): string { return this.value; } }

test("YouTube configuration requires a dedicated encryption key and exact callback", () => {
  const valid = readYouTubeConfiguration({ GOOGLE_CLIENT_ID: "client", GOOGLE_CLIENT_SECRET: "secret", APP_BASE_URL: "http://localhost:3002", YOUTUBE_TOKEN_ENCRYPTION_KEY: "youtube-encryption-key-at-least-32-characters", YOUTUBE_TOKEN_ENCRYPTION_KEY_ID: "v2" });
  assert.equal(valid.status, "success");
  if (valid.status === "success") {
    assert.equal(valid.value.redirectUri, "http://localhost:3002/api/youtube/callback");
    assert.equal(valid.value.tokenEncryptionKeyId, "v2");
  }
  assert.equal(readYouTubeConfiguration({ GOOGLE_CLIENT_ID: "client", APP_BASE_URL: "http://localhost:3002" }).status, "failure");
  assert.equal(readYouTubeConfiguration({ GOOGLE_CLIENT_ID: "client", YOUTUBE_REDIRECT_URI: "http://localhost:3002/api/auth/google/callback", YOUTUBE_TOKEN_ENCRYPTION_KEY: "youtube-encryption-key-at-least-32-characters" }).status, "failure");
});

test("YouTube authorization state is expiring and single-use", () => {
  const store = new YouTubeAuthorizationStateStore(new TestClock(NOW));
  store.save("handle", { userId: "user", state: "state", nonce: "nonce", codeVerifier: "verifier", returnTo: "/es/youtube-analyzer", createdAt: NOW, expiresAt: "2026-08-02T12:10:00.000Z" });
  assert.equal(store.consume("handle")?.userId, "user");
  assert.equal(store.consume("handle"), undefined);
  const expired = new YouTubeAuthorizationStateStore(new TestClock("2026-08-02T12:11:00.000Z"));
  expired.save("expired", { userId: "user", state: "state", nonce: "nonce", codeVerifier: "verifier", returnTo: "/es/youtube-analyzer", createdAt: NOW, expiresAt: "2026-08-02T12:10:00.000Z" });
  assert.equal(expired.consume("expired"), undefined);
});

test("YouTube authorization state distinguishes missing, expired, and consumed transactions", () => {
  const current = new YouTubeAuthorizationStateStore(new TestClock(NOW));
  const missing = current.consumeResult("missing");
  assert.equal(missing.status, "failure");
  if (missing.status === "failure") assert.equal(missing.error.code, "authorization-state-missing");
  current.save("consumed", { userId: "user", state: "state", nonce: "nonce", codeVerifier: "verifier", returnTo: "/es/youtube-analyzer", createdAt: NOW, expiresAt: "2026-08-02T12:10:00.000Z" });
  assert.equal(current.consumeResult("consumed").status, "success");
  const consumed = current.consumeResult("consumed");
  assert.equal(consumed.status, "failure");
  if (consumed.status === "failure") assert.equal(consumed.error.code, "authorization-state-consumed");
  const later = new YouTubeAuthorizationStateStore(new TestClock("2026-08-02T12:11:00.000Z"));
  later.save("expired", { userId: "user", state: "state", nonce: "nonce", codeVerifier: "verifier", returnTo: "/es/youtube-analyzer", createdAt: NOW, expiresAt: "2026-08-02T12:10:00.000Z" });
  const expired = later.consumeResult("expired");
  assert.equal(expired.status, "failure");
  if (expired.status === "failure") assert.equal(expired.error.code, "authorization-state-expired");
});

test("YouTube diagnostics redact OAuth credentials and preserve safe nested subcodes", () => {
  const error = Object.assign(new Error("authorization_code=private-code access_token=private-token"), { code: "OAUTH_RESPONSE_IS_ERROR", cause: { error: "invalid_grant", client_secret: "private-secret" } });
  const diagnostic = createYouTubeDiagnostic({ stage: "token-exchange", code: readSafeYouTubeOAuthCode(error, "fallback"), cause: "The provider returned a controlled OAuth error.", error });
  const serialized = JSON.stringify(diagnostic);
  assert.equal(diagnostic.code, "invalid_grant");
  assert.equal(readSafeYouTubeOAuthCode({ error: { errors: [{ reason: "quotaExceeded" }] } }, "fallback"), "quotaExceeded");
  assert.equal(readSafeYouTubeOAuthCode({ error: "access_denied" }, "fallback"), "access_denied");
  assert.equal(readSafeYouTubeOAuthCode({ error: "authorization_code=private-code" }, "fallback"), "fallback");
  assert.equal(classifyYouTubeTokenExchangeCode("invalid_code_verifier"), "pkce-failure");
  assert.equal(classifyYouTubeTokenExchangeCode("invalid_grant"), "invalid_grant");
  assert.match(diagnostic.stack ?? "", /\[redacted\]/u);
  assert.doesNotMatch(serialized, /private-code|private-token|private-secret|authorization_code|access_token|client_secret/u);
});

test("YouTube state cookie supports localhost without weakening its scope", () => {
  const cookie = youtubeStateCookie("opaque-handle", false);
  assert.equal(cookie, "creatoros_youtube_state=opaque-handle; Path=/api/youtube; HttpOnly; SameSite=Lax; Max-Age=600");
  assert.doesNotMatch(cookie, /(?:^|; )Secure(?:;|$)/u);
  assert.doesNotMatch(cookie, /Domain=/u);
  assert.equal(clearYouTubeStateCookie(false), "creatoros_youtube_state=; Path=/api/youtube; HttpOnly; SameSite=Lax; Max-Age=0");
});

test("YouTube state cookie is secure in production and remains path-limited", () => {
  const cookie = youtubeStateCookie("opaque-handle", true);
  assert.equal(cookie, "creatoros_youtube_state=opaque-handle; Path=/api/youtube; HttpOnly; SameSite=Lax; Max-Age=600; Secure");
  assert.doesNotMatch(cookie, /Domain=/u);
  assert.equal(clearYouTubeStateCookie(true), "creatoros_youtube_state=; Path=/api/youtube; HttpOnly; SameSite=Lax; Max-Age=0; Secure");
});

test("YouTube return target allowlist rejects open redirects", () => {
  assert.equal(safeYouTubeReturnTo("/pt-BR/youtube-analyzer"), "/pt-BR/youtube-analyzer");
  for (const value of ["https://evil.example", "//evil.example", "/es/mission-control", "/es/youtube-analyzer?next=evil"]) assert.equal(safeYouTubeReturnTo(value), "/es/youtube-analyzer");
});
