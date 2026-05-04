-- Add role column: 10=USER, 50=ADMIN, 100=MASTER
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" INTEGER NOT NULL DEFAULT 10;

-- Backfill: existing admins become MASTER (they had full admin panel access)
UPDATE "users" SET "role" = 100 WHERE "is_admin" = true AND "role" = 10;

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" ("role");
