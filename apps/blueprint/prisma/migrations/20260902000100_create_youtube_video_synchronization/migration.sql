CREATE TABLE "youtube_videos" (
  "video_id" VARCHAR(255) NOT NULL,
  "user_id" VARCHAR(255) NOT NULL,
  "channel_id" VARCHAR(255) NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "published_at" TIMESTAMPTZ(3) NOT NULL,
  "thumbnail_url" TEXT,
  "duration_seconds" INTEGER NOT NULL,
  "view_count" DECIMAL(20,0),
  "like_count" DECIMAL(20,0),
  "comment_count" DECIMAL(20,0),
  "privacy_status" VARCHAR(16),
  "tags" TEXT[] NOT NULL,
  "category_id" VARCHAR(64),
  "default_language" VARCHAR(32),
  "source_etag" VARCHAR(255),
  "availability_status" VARCHAR(16) NOT NULL,
  "last_seen_at" TIMESTAMPTZ(3) NOT NULL,
  "last_synced_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "youtube_videos_pkey" PRIMARY KEY ("video_id")
);

CREATE TABLE "youtube_video_syncs" (
  "sync_id" VARCHAR(255) NOT NULL,
  "user_id" VARCHAR(255) NOT NULL,
  "youtube_identity_id" VARCHAR(255) NOT NULL,
  "channel_id" VARCHAR(255) NOT NULL,
  "outcome" VARCHAR(16) NOT NULL,
  "discovered_count" INTEGER NOT NULL,
  "created_count" INTEGER NOT NULL,
  "updated_count" INTEGER NOT NULL,
  "unchanged_count" INTEGER NOT NULL,
  "unavailable_count" INTEGER NOT NULL,
  "coverage_count" INTEGER NOT NULL,
  "coverage_limit" INTEGER NOT NULL,
  "truncated" BOOLEAN NOT NULL,
  "failure_code" VARCHAR(64),
  "started_at" TIMESTAMPTZ(3) NOT NULL,
  "completed_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "youtube_video_syncs_pkey" PRIMARY KEY ("sync_id")
);

CREATE INDEX "youtube_videos_user_publication_idx"
  ON "youtube_videos"("user_id", "published_at" DESC, "video_id" ASC);
CREATE INDEX "youtube_videos_channel_publication_idx"
  ON "youtube_videos"("channel_id", "published_at" DESC);
CREATE INDEX "video_syncs_user_history_idx"
  ON "youtube_video_syncs"("user_id", "started_at" DESC, "sync_id" ASC);

ALTER TABLE "youtube_videos"
  ADD CONSTRAINT "youtube_videos_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "youtube_videos"
  ADD CONSTRAINT "youtube_videos_channel_id_fkey"
  FOREIGN KEY ("channel_id") REFERENCES "youtube_channels"("channel_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "youtube_video_syncs"
  ADD CONSTRAINT "youtube_video_syncs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "youtube_video_syncs"
  ADD CONSTRAINT "youtube_video_syncs_youtube_identity_id_fkey"
  FOREIGN KEY ("youtube_identity_id") REFERENCES "youtube_identities"("youtube_identity_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "youtube_video_syncs"
  ADD CONSTRAINT "youtube_video_syncs_channel_id_fkey"
  FOREIGN KEY ("channel_id") REFERENCES "youtube_channels"("channel_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
