import type { RefreshedYouTubeGrant } from "./models";

export type TokenProtectionResult<TValue> = Readonly<{ status: "success"; value: TValue }> | Readonly<{ status: "failure"; error: Readonly<{ code: "token-protection-failed"; message: string }> }>;

export interface YouTubeTokenProtector {
  readonly activeKeyId: string;
  protect(value: string): Promise<TokenProtectionResult<string>>;
  reveal(value: string): Promise<TokenProtectionResult<string>>;
}

export type YouTubeProviderResult<TValue> = Readonly<{ status: "success"; value: TValue }> | Readonly<{ status: "failure"; error: Readonly<{ code: "refresh-failed" | "revocation-failed"; message: string }> }>;

export interface YouTubeAuthorizationProvider {
  refresh(refreshToken: string): Promise<YouTubeProviderResult<RefreshedYouTubeGrant>>;
  revoke(token: string): Promise<YouTubeProviderResult<true>>;
}
