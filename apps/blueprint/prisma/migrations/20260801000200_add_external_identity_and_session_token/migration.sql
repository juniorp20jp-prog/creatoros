ALTER TABLE "identities"
  ADD COLUMN "provider" VARCHAR(32),
  ADD COLUMN "provider_subject" VARCHAR(255);

UPDATE "identities"
SET "provider" = 'internal', "provider_subject" = "identity_id";

ALTER TABLE "identities"
  ALTER COLUMN "provider" SET NOT NULL,
  ALTER COLUMN "provider_subject" SET NOT NULL,
  ADD CONSTRAINT "identities_provider_check" CHECK ("provider" IN ('internal', 'google'));

DROP INDEX "identities_user_id_key";
CREATE UNIQUE INDEX "identities_provider_subject_key" ON "identities"("provider", "provider_subject");
CREATE INDEX "identities_user_idx" ON "identities"("user_id", "created_at" ASC);

ALTER TABLE "users" ALTER COLUMN "timezone" DROP NOT NULL;

ALTER TABLE "sessions" ADD COLUMN "token_hash" CHAR(64);

UPDATE "sessions"
SET "token_hash" = md5("session_id") || md5('creatoros-invalidated-legacy-session');

ALTER TABLE "sessions" ALTER COLUMN "token_hash" SET NOT NULL;
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
