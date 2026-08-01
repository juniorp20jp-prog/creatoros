CREATE TABLE "users" (
  "user_id" VARCHAR(255) NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "display_name" VARCHAR(255) NOT NULL,
  "locale" VARCHAR(8) NOT NULL,
  "timezone" VARCHAR(100) NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "users_locale_check" CHECK ("locale" IN ('es', 'en', 'fr', 'pt-BR')),
  CONSTRAINT "users_status_check" CHECK ("status" IN ('active', 'suspended', 'disabled'))
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "identities" (
  "identity_id" VARCHAR(255) NOT NULL,
  "user_id" VARCHAR(255) NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "identities_pkey" PRIMARY KEY ("identity_id"),
  CONSTRAINT "identities_status_check" CHECK ("status" IN ('active', 'disabled')),
  CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "identities_user_id_key" ON "identities"("user_id");

CREATE TABLE "sessions" (
  "session_id" VARCHAR(255) NOT NULL,
  "user_id" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "last_activity_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  "metadata" JSONB NOT NULL,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("session_id"),
  CONSTRAINT "sessions_expiration_check" CHECK ("expires_at" > "created_at"),
  CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "sessions_user_history_idx" ON "sessions"("user_id", "created_at" DESC, "session_id" ASC);
CREATE INDEX "sessions_expiration_idx" ON "sessions"("expires_at");
