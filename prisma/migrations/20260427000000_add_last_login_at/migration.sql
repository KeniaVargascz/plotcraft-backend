-- Add last_login_at field to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMPTZ;

-- Index for querying inactive users
CREATE INDEX IF NOT EXISTS "users_last_login_at_idx" ON "users" ("last_login_at");

-- Backfill: set last_login_at to updated_at for existing users
UPDATE "users" SET "last_login_at" = "updated_at" WHERE "last_login_at" IS NULL;
