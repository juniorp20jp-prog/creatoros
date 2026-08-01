export type SessionTokenPair = Readonly<{ token: string; tokenHash: string }>;

export class SessionTokenService {
  constructor(private readonly secret?: string) {
    if (secret !== undefined && secret.length < 32) throw new Error("Session cookie secret must contain at least 32 characters.");
  }

  async generate(): Promise<SessionTokenPair> {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Buffer.from(bytes).toString("base64url");
    return { token, tokenHash: await this.hash(token) };
  }

  async hash(token: string): Promise<string> {
    const input = new TextEncoder().encode(token);
    const digest = this.secret
      ? await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", new TextEncoder().encode(this.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), input)
      : await crypto.subtle.digest("SHA-256", input);
    return Buffer.from(digest).toString("hex");
  }

  isValidFormat(token: string): boolean {
    return /^[A-Za-z0-9_-]{43}$/.test(token);
  }
}
