CREATE TABLE "youtube_channels" (
    "channel_id" VARCHAR(255) NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "youtube_identity_id" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "handle" VARCHAR(255),
    "description" TEXT NOT NULL,
    "published_at" TIMESTAMPTZ(3) NOT NULL,
    "country" VARCHAR(8),
    "custom_url" VARCHAR(255),
    "thumbnail_url" TEXT,
    "banner_url" TEXT,
    "subscriber_count" DECIMAL(20,0),
    "view_count" DECIMAL(20,0) NOT NULL,
    "video_count" DECIMAL(20,0) NOT NULL,
    "hidden_subscriber_count" BOOLEAN NOT NULL,
    "default_language" VARCHAR(32),
    "keywords" TEXT[] NOT NULL,
    "branding_settings" JSONB NOT NULL,
    "privacy_status" VARCHAR(16) NOT NULL,
    "source_etag" VARCHAR(255),
    "last_synced_at" TIMESTAMPTZ(3) NOT NULL,
    "sync_status" VARCHAR(16) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "youtube_channels_pkey" PRIMARY KEY ("channel_id")
);

CREATE TABLE "channel_syncs" (
    "sync_id" VARCHAR(255) NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "youtube_identity_id" VARCHAR(255) NOT NULL,
    "channel_id" VARCHAR(255),
    "outcome" VARCHAR(16) NOT NULL,
    "changed_fields" TEXT[] NOT NULL,
    "failure_code" VARCHAR(64),
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "channel_syncs_pkey" PRIMARY KEY ("sync_id")
);

CREATE UNIQUE INDEX "youtube_channels_user_key" ON "youtube_channels"("user_id");
CREATE UNIQUE INDEX "youtube_channels_identity_key" ON "youtube_channels"("youtube_identity_id");
CREATE INDEX "channel_syncs_user_history_idx" ON "channel_syncs"("user_id", "started_at" DESC, "sync_id" ASC);

ALTER TABLE "youtube_channels" ADD CONSTRAINT "youtube_channels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "youtube_channels" ADD CONSTRAINT "youtube_channels_youtube_identity_id_fkey" FOREIGN KEY ("youtube_identity_id") REFERENCES "youtube_identities"("youtube_identity_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_syncs" ADD CONSTRAINT "channel_syncs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_syncs" ADD CONSTRAINT "channel_syncs_youtube_identity_id_fkey" FOREIGN KEY ("youtube_identity_id") REFERENCES "youtube_identities"("youtube_identity_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_syncs" ADD CONSTRAINT "channel_syncs_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "youtube_channels"("channel_id") ON DELETE SET NULL ON UPDATE CASCADE;
