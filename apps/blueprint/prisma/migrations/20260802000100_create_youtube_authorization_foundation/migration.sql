CREATE TABLE "youtube_identities" (
    "youtube_identity_id" VARCHAR(255) NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "provider_user_id" VARCHAR(255) NOT NULL,
    "channel_id" VARCHAR(255) NOT NULL,
    "channel_title" VARCHAR(255) NOT NULL,
    "scopes" TEXT[] NOT NULL,
    "state" VARCHAR(16) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    CONSTRAINT "youtube_identities_pkey" PRIMARY KEY ("youtube_identity_id")
);

CREATE TABLE "youtube_tokens" (
    "token_id" VARCHAR(255) NOT NULL,
    "youtube_identity_id" VARCHAR(255) NOT NULL,
    "encrypted_refresh_token" TEXT NOT NULL,
    "encrypted_access_token" TEXT,
    "access_token_expires_at" TIMESTAMPTZ(3),
    "encryption_key_id" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "youtube_tokens_pkey" PRIMARY KEY ("token_id")
);

CREATE UNIQUE INDEX "youtube_identities_user_key" ON "youtube_identities"("user_id");
CREATE UNIQUE INDEX "youtube_identities_channel_key" ON "youtube_identities"("channel_id");
CREATE INDEX "youtube_identities_provider_user_idx" ON "youtube_identities"("provider_user_id");
CREATE UNIQUE INDEX "youtube_tokens_identity_key" ON "youtube_tokens"("youtube_identity_id");

ALTER TABLE "youtube_identities" ADD CONSTRAINT "youtube_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "youtube_tokens" ADD CONSTRAINT "youtube_tokens_youtube_identity_id_fkey" FOREIGN KEY ("youtube_identity_id") REFERENCES "youtube_identities"("youtube_identity_id") ON DELETE CASCADE ON UPDATE CASCADE;
