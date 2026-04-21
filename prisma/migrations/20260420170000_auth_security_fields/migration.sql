-- Add security fields to users table (account lockout)
ALTER TABLE "users" ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "locked_until" TIMESTAMP(3);

-- Add token family rotation fields to refresh_tokens
ALTER TABLE "refresh_tokens" ADD COLUMN "family" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "refresh_tokens" ADD COLUMN "revoked_at" TIMESTAMP(3);

-- Performance indexes for auth security
CREATE INDEX "refresh_tokens_userId_revoked_idx" ON "refresh_tokens"("user_id", "revoked");
CREATE INDEX "refresh_tokens_family_idx" ON "refresh_tokens"("family");
