CREATE TABLE IF NOT EXISTS "user_data_backups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "data" JSONB NOT NULL,
  "data_size" INTEGER NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expires_at" TIMESTAMPTZ NOT NULL,
  "restored_at" TIMESTAMPTZ,

  CONSTRAINT "user_data_backups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_data_backups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "user_data_backups_user_id_idx" ON "user_data_backups" ("user_id");
CREATE INDEX IF NOT EXISTS "user_data_backups_expires_at_idx" ON "user_data_backups" ("expires_at");
