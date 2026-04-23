-- Partial index on locked_until for efficient account lockout checks during login.
-- Only indexes rows where locked_until IS NOT NULL (actively locked accounts).
CREATE INDEX IF NOT EXISTS idx_users_locked_until
  ON users (locked_until)
  WHERE locked_until IS NOT NULL;

-- Replace the existing (user_id, type) index with a covering index
-- that includes used_at for the OTP verification query:
--   WHERE user_id = $1 AND type = $2 AND used_at IS NULL
-- This lets Postgres use an index-only scan instead of a sequential filter.
DROP INDEX IF EXISTS "otp_codes_user_id_type_idx";

CREATE INDEX IF NOT EXISTS idx_otp_codes_user_type_used
  ON otp_codes (user_id, type, used_at)
  WHERE used_at IS NULL;
