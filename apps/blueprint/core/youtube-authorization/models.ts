export const YOUTUBE_PROVIDER = "youtube" as const;

export type YouTubeConnectionState = "connected" | "revoked";

export type YouTubeIdentity = Readonly<{
  youtubeIdentityId: string;
  userId: string;
  provider: typeof YOUTUBE_PROVIDER;
  providerUserId: string;
  channelId: string;
  channelTitle: string;
  scopes: ReadonlyArray<string>;
  state: YouTubeConnectionState;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
}>;

/** Encrypted provider credentials. Plaintext tokens never cross this contract. */
export type YouTubeTokenRecord = Readonly<{
  tokenId: string;
  youtubeIdentityId: string;
  encryptedRefreshToken: string;
  encryptedAccessToken?: string;
  accessTokenExpiresAt?: string;
  encryptionKeyId: string;
  createdAt: string;
  updatedAt: string;
}>;

export type YouTubeConnectionStatus = Readonly<{
  connected: boolean;
  channelId?: string;
  channelTitle?: string;
  scopes: ReadonlyArray<string>;
  connectedAt?: string;
  updatedAt?: string;
}>;

export type VerifiedYouTubeGrant = Readonly<{
  providerUserId: string;
  channelId: string;
  channelTitle: string;
  scopes: ReadonlyArray<string>;
  refreshToken?: string;
  accessToken?: string;
  accessTokenExpiresAt?: string;
}>;

export type RefreshedYouTubeGrant = Readonly<{
  refreshToken?: string;
  accessToken: string;
  accessTokenExpiresAt?: string;
  scopes?: ReadonlyArray<string>;
}>;
