import assert from "node:assert/strict";
import { test } from "node:test";

import { AesGcmYouTubeTokenProtector } from "../aes-gcm-token-protector";

const SECRET_V1 = "youtube-test-encryption-secret-v1-at-least-32";
const SECRET_V2 = "youtube-test-encryption-secret-v2-at-least-32";

test("AES-GCM protects tokens with randomized authenticated ciphertext", async () => {
  const protector = new AesGcmYouTubeTokenProtector("v1", { v1: SECRET_V1 });
  const first = await protector.protect("refresh-token");
  const second = await protector.protect("refresh-token");
  assert.equal(first.status, "success");
  assert.equal(second.status, "success");
  if (first.status !== "success" || second.status !== "success") return;
  assert.notEqual(first.value, second.value);
  assert.equal(first.value.includes("refresh-token"), false);
  assert.deepEqual(await protector.reveal(first.value), { status: "success", value: "refresh-token" });
});

test("AES-GCM rejects tampered ciphertext", async () => {
  const protector = new AesGcmYouTubeTokenProtector("v1", { v1: SECRET_V1 });
  const protectedToken = await protector.protect("refresh-token");
  if (protectedToken.status !== "success") return;
  const parts = protectedToken.value.split(".");
  const tag = Buffer.from(parts[4] ?? "", "base64url");
  tag[0] = (tag[0] ?? 0) ^ 1;
  parts[4] = tag.toString("base64url");
  const tampered = parts.join(".");
  assert.equal((await protector.reveal(tampered)).status, "failure");
});

test("AES-GCM keyring decrypts old keys while new writes use the active key", async () => {
  const oldProtector = new AesGcmYouTubeTokenProtector("v1", { v1: SECRET_V1 });
  const oldValue = await oldProtector.protect("refresh-token");
  if (oldValue.status !== "success") return;
  const rotated = new AesGcmYouTubeTokenProtector("v2", { v1: SECRET_V1, v2: SECRET_V2 });
  assert.deepEqual(await rotated.reveal(oldValue.value), { status: "success", value: "refresh-token" });
  const newValue = await rotated.protect("refresh-token");
  if (newValue.status === "success") assert.match(newValue.value, /^yt1\.v2\./u);
});
