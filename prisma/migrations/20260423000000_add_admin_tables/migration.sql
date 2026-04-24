-- CreateTable
CREATE TABLE IF NOT EXISTS "admin_feature_flags" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,

    CONSTRAINT "admin_feature_flags_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "admin_email" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admin_feature_flags_group_idx" ON "admin_feature_flags"("group");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admin_audit_logs_admin_id_idx" ON "admin_audit_logs"("admin_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admin_audit_logs_resource_type_idx" ON "admin_audit_logs"("resource_type");
