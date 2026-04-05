CREATE TYPE "MediaUploadType" AS ENUM ('AVATAR', 'BANNER');

CREATE TABLE "media_uploads" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "MediaUploadType" NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size" INTEGER NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_uploads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "media_uploads_user_id_type_idx" ON "media_uploads"("user_id", "type");

ALTER TABLE "media_uploads"
ADD CONSTRAINT "media_uploads_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
