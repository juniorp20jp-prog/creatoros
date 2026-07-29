CREATE TABLE "analysis_runs" (
    "analysis_run_id" VARCHAR(255) NOT NULL,
    "creator_id" VARCHAR(255) NOT NULL,
    "channel_id" VARCHAR(255) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "source" JSONB NOT NULL,
    "adapter_metadata" JSONB,
    "adapter_warnings" JSONB NOT NULL,
    "pipeline_version" VARCHAR(255) NOT NULL,
    "analysis_result" JSONB,
    "failure" JSONB,
    "correlation_id" VARCHAR(255),
    "attempt" INTEGER NOT NULL,
    "retry_of_analysis_run_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "analysis_runs_pkey" PRIMARY KEY ("analysis_run_id"),
    CONSTRAINT "analysis_runs_status_check"
      CHECK ("status" IN ('pending', 'processing', 'completed', 'failed')),
    CONSTRAINT "analysis_runs_schema_version_check"
      CHECK ("schema_version" > 0),
    CONSTRAINT "analysis_runs_revision_check"
      CHECK ("revision" > 0),
    CONSTRAINT "analysis_runs_attempt_check"
      CHECK ("attempt" > 0),
    CONSTRAINT "analysis_runs_source_object_check"
      CHECK (jsonb_typeof("source") = 'object'),
    CONSTRAINT "analysis_runs_adapter_metadata_object_check"
      CHECK ("adapter_metadata" IS NULL OR jsonb_typeof("adapter_metadata") = 'object'),
    CONSTRAINT "analysis_runs_adapter_warnings_array_check"
      CHECK (jsonb_typeof("adapter_warnings") = 'array'),
    CONSTRAINT "analysis_runs_analysis_result_object_check"
      CHECK ("analysis_result" IS NULL OR jsonb_typeof("analysis_result") = 'object'),
    CONSTRAINT "analysis_runs_failure_object_check"
      CHECK ("failure" IS NULL OR jsonb_typeof("failure") = 'object'),
    CONSTRAINT "analysis_runs_timestamp_order_check"
      CHECK ("updated_at" >= "created_at"),
    CONSTRAINT "analysis_runs_terminal_payload_check"
      CHECK (
        (
          "status" IN ('pending', 'processing')
          AND "analysis_result" IS NULL
          AND "failure" IS NULL
          AND "completed_at" IS NULL
        )
        OR (
          "status" = 'completed'
          AND "analysis_result" IS NOT NULL
          AND "adapter_metadata" IS NOT NULL
          AND "failure" IS NULL
          AND "completed_at" IS NOT NULL
        )
        OR (
          "status" = 'failed'
          AND "analysis_result" IS NULL
          AND "failure" IS NOT NULL
          AND "completed_at" IS NOT NULL
        )
      )
);

CREATE INDEX "analysis_runs_channel_history_idx"
  ON "analysis_runs" ("channel_id", "created_at" DESC, "analysis_run_id" ASC);

CREATE INDEX "analysis_runs_channel_status_history_idx"
  ON "analysis_runs" (
    "channel_id",
    "status",
    "created_at" DESC,
    "analysis_run_id" ASC
  );
