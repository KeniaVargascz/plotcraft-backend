-- Add is_active column to genres table
ALTER TABLE "genres" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
