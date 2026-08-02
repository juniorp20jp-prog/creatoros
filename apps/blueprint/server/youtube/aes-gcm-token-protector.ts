import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import type { TokenProtectionResult, YouTubeTokenProtector } from "../../core";

const VERSION = "yt1";

/** AES-256-GCM envelope with a key id so ciphertext can be rotated in place. */
export class AesGcmYouTubeTokenProtector implements YouTubeTokenProtector {
  private readonly keys = new Map<string, Buffer>();

  constructor(readonly activeKeyId: string, secrets: Readonly<Record<string, string>>) {
    for (const [keyId, secret] of Object.entries(secrets)) {
      if (/^[A-Za-z0-9_-]{1,32}$/u.test(keyId) && secret.length >= 32) this.keys.set(keyId, createHash("sha256").update(secret, "utf8").digest());
    }
    if (!this.keys.has(activeKeyId)) throw new Error("Active YouTube encryption key is unavailable.");
  }

  async protect(value: string): Promise<TokenProtectionResult<string>> {
    if (!value) return failure();
    try {
      const key = this.keys.get(this.activeKeyId);
      if (!key) return failure();
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(Buffer.from(`${VERSION}.${this.activeKeyId}`, "utf8"));
      const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
      return { status: "success", value: [VERSION, this.activeKeyId, iv.toString("base64url"), ciphertext.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".") };
    } catch { return failure(); }
  }

  async reveal(value: string): Promise<TokenProtectionResult<string>> {
    try {
      const [version, keyId, ivValue, ciphertextValue, tagValue, extra] = value.split(".");
      if (version !== VERSION || !keyId || !ivValue || !ciphertextValue || !tagValue || extra !== undefined) return failure();
      const key = this.keys.get(keyId);
      if (!key) return failure();
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
      decipher.setAAD(Buffer.from(`${VERSION}.${keyId}`, "utf8"));
      decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
      const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString("utf8");
      return plaintext ? { status: "success", value: plaintext } : failure();
    } catch { return failure(); }
  }
}

function failure(): TokenProtectionResult<never> { return { status: "failure", error: { code: "token-protection-failed", message: "YouTube token protection failed." } }; }
