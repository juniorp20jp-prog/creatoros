ALTER TABLE "metric_observation_batches"
  ADD COLUMN "requested_start_date" DATE,
  ADD COLUMN "requested_end_date" DATE,
  ADD COLUMN "effective_data_through" DATE,
  ADD COLUMN "available_fields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "missing_fields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "youtube_analytics_capabilities" (
  "user_id" VARCHAR(255) NOT NULL,
  "youtube_identity_id" VARCHAR(255) NOT NULL,
  "state" VARCHAR(32) NOT NULL,
  "authorized_at" TIMESTAMPTZ(3),
  "last_collection_at" TIMESTAMPTZ(3),
  "effective_data_through" DATE,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "youtube_analytics_capabilities_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "channel_daily_analytics_observations" (
  "batch_id" VARCHAR(255) NOT NULL,
  "metric_date" DATE NOT NULL,
  "views" DECIMAL(30,6),
  "estimated_minutes_watched" DECIMAL(30,6),
  "average_view_duration" DECIMAL(30,6),
  "average_view_percentage" DECIMAL(30,6),
  "subscribers_gained" DECIMAL(30,6),
  "subscribers_lost" DECIMAL(30,6),
  "likes" DECIMAL(30,6),
  "comments" DECIMAL(30,6),
  "shares" DECIMAL(30,6),
  "available_fields" TEXT[] NOT NULL,
  CONSTRAINT "channel_daily_analytics_observations_pkey" PRIMARY KEY ("batch_id", "metric_date")
);

CREATE TABLE "video_daily_analytics_observations" (
  "batch_id" VARCHAR(255) NOT NULL,
  "video_id" VARCHAR(255) NOT NULL,
  "metric_date" DATE NOT NULL,
  "views" DECIMAL(30,6),
  "estimated_minutes_watched" DECIMAL(30,6),
  "average_view_duration" DECIMAL(30,6),
  "average_view_percentage" DECIMAL(30,6),
  "subscribers_gained" DECIMAL(30,6),
  "subscribers_lost" DECIMAL(30,6),
  "likes" DECIMAL(30,6),
  "comments" DECIMAL(30,6),
  "shares" DECIMAL(30,6),
  "available_fields" TEXT[] NOT NULL,
  CONSTRAINT "video_daily_analytics_observations_pkey" PRIMARY KEY ("batch_id", "video_id", "metric_date")
);

CREATE UNIQUE INDEX "youtube_analytics_capabilities_identity_key" ON "youtube_analytics_capabilities"("youtube_identity_id");
CREATE INDEX "channel_daily_analytics_date_idx" ON "channel_daily_analytics_observations"("metric_date", "batch_id");
CREATE INDEX "video_daily_analytics_video_date_idx" ON "video_daily_analytics_observations"("video_id", "metric_date", "batch_id");

ALTER TABLE "youtube_analytics_capabilities" ADD CONSTRAINT "youtube_analytics_capabilities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "youtube_analytics_capabilities" ADD CONSTRAINT "youtube_analytics_capabilities_youtube_identity_id_fkey" FOREIGN KEY ("youtube_identity_id") REFERENCES "youtube_identities"("youtube_identity_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_daily_analytics_observations" ADD CONSTRAINT "channel_daily_analytics_observations_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "metric_observation_batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "video_daily_analytics_observations" ADD CONSTRAINT "video_daily_analytics_observations_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "metric_observation_batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;
