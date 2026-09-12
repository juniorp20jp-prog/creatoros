CREATE TABLE "metric_observation_batches" (
  "batch_id" VARCHAR(255) NOT NULL,
  "user_id" VARCHAR(255) NOT NULL,
  "channel_id" VARCHAR(255) NOT NULL,
  "source_sync_id" VARCHAR(255) NOT NULL,
  "source_type" VARCHAR(32) NOT NULL,
  "provider" VARCHAR(32) NOT NULL,
  "observed_at" TIMESTAMPTZ(3) NOT NULL,
  "collection_outcome" VARCHAR(16) NOT NULL,
  "availability" VARCHAR(32) NOT NULL,
  "coverage_count" INTEGER NOT NULL,
  "coverage_limit" INTEGER,
  "truncated" BOOLEAN NOT NULL,
  "schema_version" INTEGER NOT NULL,
  "provenance" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "metric_observation_batches_pkey" PRIMARY KEY ("batch_id")
);

CREATE TABLE "channel_metric_observations" (
  "batch_id" VARCHAR(255) NOT NULL,
  "subscriber_count" DECIMAL(20,0),
  "view_count" DECIMAL(20,0),
  "video_count" DECIMAL(20,0),
  "hidden_subscriber_count" BOOLEAN,
  "source_etag" VARCHAR(255),
  "available_fields" TEXT[] NOT NULL,
  CONSTRAINT "channel_metric_observations_pkey" PRIMARY KEY ("batch_id")
);

CREATE TABLE "video_metric_observations" (
  "batch_id" VARCHAR(255) NOT NULL,
  "video_id" VARCHAR(255) NOT NULL,
  "view_count" DECIMAL(20,0),
  "like_count" DECIMAL(20,0),
  "comment_count" DECIMAL(20,0),
  "source_etag" VARCHAR(255),
  "availability_status" VARCHAR(32) NOT NULL,
  "available_fields" TEXT[] NOT NULL,
  CONSTRAINT "video_metric_observations_pkey" PRIMARY KEY ("batch_id", "video_id")
);

CREATE UNIQUE INDEX "metric_observation_batches_source_sync_key" ON "metric_observation_batches"("source_type", "source_sync_id");
CREATE INDEX "metric_observation_batches_channel_history_idx" ON "metric_observation_batches"("user_id", "channel_id", "observed_at" DESC, "batch_id" ASC);
CREATE INDEX "video_metric_observations_video_idx" ON "video_metric_observations"("video_id", "batch_id");

ALTER TABLE "metric_observation_batches" ADD CONSTRAINT "metric_observation_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "metric_observation_batches" ADD CONSTRAINT "metric_observation_batches_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "youtube_channels"("channel_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_metric_observations" ADD CONSTRAINT "channel_metric_observations_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "metric_observation_batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "video_metric_observations" ADD CONSTRAINT "video_metric_observations_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "metric_observation_batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- No backfill: observations before Sprint 11.8 are unknown and are not reconstructed.
