import * as oidc from "openid-client";

import type { Clock, RefreshedYouTubeGrant, VerifiedYouTubeGrant, YouTubeAuthorizationProvider, YouTubeProviderResult } from "../../core";
import { YOUTUBE_READONLY_SCOPE } from "../../core";
import type { YouTubeAuthorizationTransaction } from "./authorization-state";

export type YouTubeAuthorizationRequest = Readonly<{ authorizationUrl: URL; state: string; nonce: string; codeVerifier: string }>;
export type YouTubeProtocolResult<TValue> = Readonly<{ status: "success"; value: TValue }> | Readonly<{ status: "failure"; error: Readonly<{ code: "provider-error" | "callback-invalid" | "channel-unavailable"; message: string }> }>;

export interface YouTubeOAuthProtocol extends YouTubeAuthorizationProvider {
  begin(): Promise<YouTubeAuthorizationRequest>;
  complete(callbackUrl: URL, transaction: YouTubeAuthorizationTransaction): Promise<YouTubeProtocolResult<VerifiedYouTubeGrant>>;
}

export class OpenIdClientYouTubeProtocol implements YouTubeOAuthProtocol {
  private constructor(private readonly configuration: oidc.Configuration, private readonly redirectUri: string, private readonly clock: Clock) {}

  static async discover(input: Readonly<{ clientId: string; clientSecret?: string; redirectUri: string; clock: Clock }>): Promise<OpenIdClientYouTubeProtocol> {
    const configuration = await oidc.discovery(new URL("https://accounts.google.com"), input.clientId, input.clientSecret ? { client_secret: input.clientSecret } : undefined, input.clientSecret ? oidc.ClientSecretPost(input.clientSecret) : oidc.None());
    return new OpenIdClientYouTubeProtocol(configuration, input.redirectUri, input.clock);
  }

  async begin(): Promise<YouTubeAuthorizationRequest> {
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const authorizationUrl = oidc.buildAuthorizationUrl(this.configuration, { redirect_uri: this.redirectUri, scope: `openid email profile ${YOUTUBE_READONLY_SCOPE}`, response_type: "code", access_type: "offline", prompt: "consent", include_granted_scopes: "true", code_challenge: codeChallenge, code_challenge_method: "S256", state, nonce });
    return { authorizationUrl, state, nonce, codeVerifier };
  }

  async complete(callbackUrl: URL, transaction: YouTubeAuthorizationTransaction): Promise<YouTubeProtocolResult<VerifiedYouTubeGrant>> {
    if (callbackUrl.searchParams.get("state") !== transaction.state || callbackUrl.searchParams.has("error")) return protocolFailure("callback-invalid", "YouTube callback could not be verified.");
    try {
      const tokens = await oidc.authorizationCodeGrant(this.configuration, callbackUrl, { expectedState: transaction.state, expectedNonce: transaction.nonce, pkceCodeVerifier: transaction.codeVerifier, idTokenExpected: true });
      const claims = tokens.claims();
      if (!claims || typeof claims.sub !== "string" || !tokens.access_token) return protocolFailure("callback-invalid", "YouTube callback claims are invalid.");
      const channel = await this.readChannel(tokens.access_token);
      if (!channel) return protocolFailure("channel-unavailable", "No YouTube channel is available for this account.");
      const scopes = (tokens.scope ?? "").split(/\s+/u).filter(Boolean);
      if (!scopes.includes(YOUTUBE_READONLY_SCOPE)) return protocolFailure("callback-invalid", "Required YouTube scope was not granted.");
      return { status: "success", value: { providerUserId: claims.sub, channelId: channel.id, channelTitle: channel.title, scopes, ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}), accessToken: tokens.access_token, ...(tokens.expires_in ? { accessTokenExpiresAt: new Date(Date.parse(this.clock.now()) + tokens.expires_in * 1000).toISOString() } : {}) } };
    } catch { return protocolFailure("provider-error", "YouTube authorization provider failed."); }
  }

  async refresh(refreshToken: string): Promise<YouTubeProviderResult<RefreshedYouTubeGrant>> {
    try {
      const tokens = await oidc.refreshTokenGrant(this.configuration, refreshToken);
      if (!tokens.access_token) return providerFailure("refresh-failed", "YouTube token refresh failed.");
      return { status: "success", value: { accessToken: tokens.access_token, ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}), ...(tokens.scope ? { scopes: tokens.scope.split(/\s+/u).filter(Boolean) } : {}), ...(tokens.expires_in ? { accessTokenExpiresAt: new Date(Date.parse(this.clock.now()) + tokens.expires_in * 1000).toISOString() } : {}) } };
    } catch { return providerFailure("refresh-failed", "YouTube token refresh failed."); }
  }

  async revoke(token: string): Promise<YouTubeProviderResult<true>> {
    try { await oidc.tokenRevocation(this.configuration, token, { token_type_hint: "refresh_token" }); return { status: "success", value: true }; }
    catch { return providerFailure("revocation-failed", "YouTube token revocation failed."); }
  }

  private async readChannel(accessToken: string): Promise<{ id: string; title: string } | undefined> {
    const response = await oidc.fetchProtectedResource(this.configuration, accessToken, new URL("https://www.googleapis.com/youtube/v3/channels?part=id%2Csnippet&mine=true&maxResults=1"), "GET");
    if (!response.ok) return undefined;
    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.items) || body.items.length !== 1 || !isRecord(body.items[0])) return undefined;
    const item = body.items[0];
    const snippet = isRecord(item.snippet) ? item.snippet : undefined;
    return typeof item.id === "string" && snippet && typeof snippet.title === "string" ? { id: item.id, title: snippet.title } : undefined;
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function protocolFailure<TValue>(code: "provider-error" | "callback-invalid" | "channel-unavailable", message: string): YouTubeProtocolResult<TValue> { return { status: "failure", error: { code, message } }; }
function providerFailure<TValue>(code: "refresh-failed" | "revocation-failed", message: string): YouTubeProviderResult<TValue> { return { status: "failure", error: { code, message } }; }
