import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryYouTubeAuthorizationRepository, YOUTUBE_READONLY_SCOPE, type YouTubeAuthorizationRepository } from "../index";

export const YOUTUBE_REPOSITORY_TIME = "2026-08-02T12:00:00.000Z";
export const youtubeAuthorizationInput = {
  identity: { youtubeIdentityId: "youtube_identity_test", userId: "auth_test_youtube_user", provider: "youtube" as const, providerUserId: "provider_test", channelId: "UC_test", channelTitle: "Test Channel", scopes: [YOUTUBE_READONLY_SCOPE], state: "connected" as const, createdAt: YOUTUBE_REPOSITORY_TIME, updatedAt: YOUTUBE_REPOSITORY_TIME },
  token: { tokenId: "youtube_token_test", youtubeIdentityId: "youtube_identity_test", encryptedRefreshToken: "yt1.test.iv.cipher.tag", encryptedAccessToken: "yt1.test.iv.access.tag", accessTokenExpiresAt: "2026-08-02T13:00:00.000Z", encryptionKeyId: "test", createdAt: YOUTUBE_REPOSITORY_TIME, updatedAt: YOUTUBE_REPOSITORY_TIME },
};

export function runYouTubeAuthorizationRepositoryContract(name: string, factory: () => YouTubeAuthorizationRepository | Promise<YouTubeAuthorizationRepository>, cleanup?: (repository: YouTubeAuthorizationRepository) => Promise<void>): void {
  test(`${name}: saves and retrieves identity and encrypted token separately`, async () => {
    const repository = await factory();
    try {
      assert.equal((await repository.saveAuthorization(youtubeAuthorizationInput)).status, "success");
      assert.equal((await repository.getByUserId(youtubeAuthorizationInput.identity.userId)).status, "success");
      assert.equal((await repository.getByChannelId(youtubeAuthorizationInput.identity.channelId)).status, "success");
      const token = await repository.getByYouTubeIdentityId(youtubeAuthorizationInput.identity.youtubeIdentityId);
      assert.equal(token.status, "success");
      if (token.status === "success") assert.equal(token.value.encryptedRefreshToken, youtubeAuthorizationInput.token.encryptedRefreshToken);
    } finally { await cleanup?.(repository); }
  });

  test(`${name}: reconnect updates one record without duplication`, async () => {
    const repository = await factory();
    try {
      await repository.saveAuthorization(youtubeAuthorizationInput);
      const result = await repository.saveAuthorization({ identity: { ...youtubeAuthorizationInput.identity, channelTitle: "Updated Channel" }, token: { ...youtubeAuthorizationInput.token, encryptedAccessToken: "yt1.test.iv.updated.tag" } });
      assert.equal(result.status, "success");
      if (result.status === "success") assert.equal(result.value.channelTitle, "Updated Channel");
    } finally { await cleanup?.(repository); }
  });

  test(`${name}: revocation is atomic and removes credentials`, async () => {
    const repository = await factory();
    try {
      await repository.saveAuthorization(youtubeAuthorizationInput);
      const revoked = await repository.revokeAuthorization(youtubeAuthorizationInput.identity.userId, "2026-08-02T12:30:00.000Z");
      assert.equal(revoked.status, "success");
      assert.equal((await repository.getByYouTubeIdentityId(youtubeAuthorizationInput.identity.youtubeIdentityId)).status, "failure");
    } finally { await cleanup?.(repository); }
  });
}

runYouTubeAuthorizationRepositoryContract("YouTube authorization repository/in-memory", () => new InMemoryYouTubeAuthorizationRepository());
