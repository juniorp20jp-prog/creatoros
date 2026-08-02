export const YOUTUBE_AUTH_STATE_COOKIE = "creatoros_youtube_state";

export function youtubeStateCookie(handle: string, production: boolean, maxAge = 600): string { return serialize(handle, production, maxAge); }
export function clearYouTubeStateCookie(production: boolean): string { return serialize("", production, 0); }

function serialize(value: string, production: boolean, maxAge: number): string {
  return `${YOUTUBE_AUTH_STATE_COOKIE}=${encodeURIComponent(value)}; Path=/api/youtube; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${production ? "; Secure" : ""}`;
}
