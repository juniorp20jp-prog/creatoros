import * as oidc from "openid-client";

import type { GoogleAuthorizationRequest, GoogleCallbackChecks, GoogleOidcProtocol } from "./google-oidc-adapter";

export class OpenIdClientGoogleProtocol implements GoogleOidcProtocol {
  private constructor(private readonly configuration: oidc.Configuration) {}

  static async discover(input: Readonly<{ clientId: string; clientSecret?: string }>): Promise<OpenIdClientGoogleProtocol> {
    const configuration = await oidc.discovery(
      new URL("https://accounts.google.com"),
      input.clientId,
      input.clientSecret ? { client_secret: input.clientSecret } : undefined,
      input.clientSecret ? oidc.ClientSecretPost(input.clientSecret) : oidc.None(),
    );
    return new OpenIdClientGoogleProtocol(configuration);
  }

  async createAuthorizationRequest(redirectUri: string): Promise<GoogleAuthorizationRequest> {
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const authorizationUrl = oidc.buildAuthorizationUrl(this.configuration, { redirect_uri: redirectUri, scope: "openid email profile", response_type: "code", code_challenge: codeChallenge, code_challenge_method: "S256", state, nonce });
    return { authorizationUrl, state, nonce, codeVerifier };
  }

  async exchangeCallback(callbackUrl: URL, checks: GoogleCallbackChecks): Promise<Readonly<Record<string, unknown>>> {
    const tokens = await oidc.authorizationCodeGrant(this.configuration, callbackUrl, { expectedState: checks.state, expectedNonce: checks.nonce, pkceCodeVerifier: checks.codeVerifier, idTokenExpected: true });
    const claims = tokens.claims();
    if (!claims) throw new Error("Verified ID token claims are required.");
    return claims;
  }
}
