import assert from "node:assert/strict";
import { test } from "node:test";

import type { Clock } from "../../../core";
import { YouTubeAuthorizationStateStore, safeYouTubeReturnTo } from "../authorization-state";
import { clearYouTubeStateCookie, youtubeStateCookie } from "../cookies";
import { readYouTubeConfiguration } from "../config";

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

test("YouTube state cookie is server-only, path-limited and secure in production", () => {
  const cookie = youtubeStateCookie("opaque-handle", true);
  assert.match(cookie, /HttpOnly/u);
  assert.match(cookie, /SameSite=Lax/u);
  assert.match(cookie, /Path=\/api\/youtube/u);
  assert.match(cookie, /Secure/u);
  assert.match(clearYouTubeStateCookie(true), /Max-Age=0/u);
});

test("YouTube return target allowlist rejects open redirects", () => {
  assert.equal(safeYouTubeReturnTo("/pt-BR/youtube-analyzer"), "/pt-BR/youtube-analyzer");
  for (const value of ["https://evil.example", "//evil.example", "/es/mission-control", "/es/youtube-analyzer?next=evil"]) assert.equal(safeYouTubeReturnTo(value), "/es/youtube-analyzer");
});
