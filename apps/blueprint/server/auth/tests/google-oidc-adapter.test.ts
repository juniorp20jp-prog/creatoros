import assert from "node:assert/strict";
import { test } from "node:test";

import { TestClock } from "../../../core/tests/fixtures/analysis-run-v2-fixtures";
import { GoogleOidcIdentityAdapter, type GoogleCallbackChecks, type GoogleOidcProtocol } from "../oidc/google-oidc-adapter";

const checks: GoogleCallbackChecks = { state: "state_test", nonce: "nonce_test", codeVerifier: "verifier_test" };
const validClaims: Readonly<Record<string, unknown>> = {
  iss: "https://accounts.google.com",
  aud: "client_test",
  exp: 1_900_000_000,
  nonce: checks.nonce,
  sub: "google_subject_test",
  email: "Creator@Example.com",
  email_verified: true,
  name: "Creator Test",
  locale: "es",
};

class FakeProtocol implements GoogleOidcProtocol {
  constructor(private readonly claims: Readonly<Record<string, unknown>> = validClaims, private readonly shouldThrow = false) {}
  async createAuthorizationRequest(redirectUri: string) {
    const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizationUrl.search = new URLSearchParams({ redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", state: checks.state, nonce: checks.nonce, code_challenge: "challenge_test", code_challenge_method: "S256" }).toString();
    return { authorizationUrl, state: checks.state, nonce: checks.nonce, codeVerifier: checks.codeVerifier };
  }
  async exchangeCallback() {
    if (this.shouldThrow) throw new Error("controlled token exchange failure");
    return this.claims;
  }
}

function adapter(claims = validClaims, shouldThrow = false) {
  return new GoogleOidcIdentityAdapter(new FakeProtocol(claims, shouldThrow), "client_test", "http://localhost:3002/api/auth/google/callback", new TestClock(["2026-08-01T12:00:00.000Z"]));
}

test("Google OIDC authorization uses code, minimum scopes, state, nonce, and PKCE S256", async () => {
  const result = await adapter().begin();
  assert.equal(result.authorizationUrl.searchParams.get("response_type"), "code");
  assert.equal(result.authorizationUrl.searchParams.get("scope"), "openid email profile");
  assert.equal(result.authorizationUrl.searchParams.get("state"), checks.state);
  assert.equal(result.authorizationUrl.searchParams.get("nonce"), checks.nonce);
  assert.equal(result.authorizationUrl.searchParams.get("code_challenge_method"), "S256");
  assert.ok(result.codeVerifier);
});

test("Google OIDC callback returns a verified external identity without tokens", async () => {
  const result = await adapter().complete(new URL(`http://localhost/callback?code=code&state=${checks.state}`), checks);
  assert.equal(result.status, "success");
  if (result.status === "success") {
    assert.equal(result.value.providerSubject, "google_subject_test");
    assert.equal(result.value.email, "creator@example.com");
    assert.doesNotMatch(JSON.stringify(result.value), /token|code_verifier/i);
  }
});

test("Google OIDC callback rejects state mismatch and provider errors", async () => {
  assert.equal((await adapter().complete(new URL("http://localhost/callback?code=x&state=wrong"), checks)).status, "failure");
  const providerError = await adapter().complete(new URL(`http://localhost/callback?error=access_denied&state=${checks.state}`), checks);
  assert.equal(providerError.status, "failure");
  if (providerError.status === "failure") assert.equal(providerError.error.code, "callback-error");
});

test("Google OIDC callback rejects invalid issuer, audience, nonce, and expiration", async () => {
  for (const claims of [
    { ...validClaims, iss: "https://issuer.invalid" },
    { ...validClaims, aud: "other-client" },
    { ...validClaims, nonce: "wrong" },
    { ...validClaims, exp: 1 },
  ]) {
    const result = await adapter(claims).complete(new URL(`http://localhost/callback?code=x&state=${checks.state}`), checks);
    assert.equal(result.status, "failure");
  }
});

test("Google OIDC callback rejects missing subject, email, and unverified email", async () => {
  for (const claims of [
    { ...validClaims, sub: undefined },
    { ...validClaims, email: undefined },
    { ...validClaims, email_verified: false },
  ]) {
    const result = await adapter(claims).complete(new URL(`http://localhost/callback?code=x&state=${checks.state}`), checks);
    assert.equal(result.status, "failure");
  }
});

test("Google OIDC token exchange failure is safe", async () => {
  const result = await adapter(validClaims, true).complete(new URL(`http://localhost/callback?code=x&state=${checks.state}`), checks);
  assert.deepEqual(result, { status: "failure", error: { code: "token-exchange-failed", message: "The identity provider callback could not be verified." } });
});
