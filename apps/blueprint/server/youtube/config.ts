export type YouTubeConfiguration = Readonly<{
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  tokenEncryptionSecret: string;
  tokenEncryptionKeyId: string;
  production: boolean;
}>;

export type YouTubeConfigurationResult = Readonly<{ status: "success"; value: YouTubeConfiguration }> | Readonly<{ status: "failure"; error: Readonly<{ code: "youtube-configuration-error"; message: string }> }>;

export function readYouTubeConfiguration(environment: Readonly<Record<string, string | undefined>> = process.env): YouTubeConfigurationResult {
  const clientId = environment.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = environment.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = validUrl(environment.YOUTUBE_REDIRECT_URI ?? deriveRedirectUri(environment.APP_BASE_URL));
  const tokenEncryptionSecret = environment.YOUTUBE_TOKEN_ENCRYPTION_KEY?.trim();
  const tokenEncryptionKeyId = environment.YOUTUBE_TOKEN_ENCRYPTION_KEY_ID?.trim() || "v1";
  const production = environment.NODE_ENV === "production";
  if (!clientId || !redirectUri || !tokenEncryptionSecret || tokenEncryptionSecret.length < 32 || !/^[A-Za-z0-9_-]{1,32}$/u.test(tokenEncryptionKeyId)) return failure();
  const parsed = new URL(redirectUri);
  if (parsed.pathname !== "/api/youtube/callback" || (production && parsed.protocol !== "https:")) return failure();
  return { status: "success", value: { clientId, ...(clientSecret ? { clientSecret } : {}), redirectUri, tokenEncryptionSecret, tokenEncryptionKeyId, production } };
}

function deriveRedirectUri(baseUrl: string | undefined): string | undefined {
  if (!baseUrl) return undefined;
  try { return new URL("/api/youtube/callback", baseUrl).toString(); } catch { return undefined; }
}
function validUrl(value: string | undefined): string | undefined { if (!value) return undefined; try { const parsed = new URL(value); return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : undefined; } catch { return undefined; } }
function failure(): YouTubeConfigurationResult { return { status: "failure", error: { code: "youtube-configuration-error", message: "YouTube authorization is not configured." } }; }
