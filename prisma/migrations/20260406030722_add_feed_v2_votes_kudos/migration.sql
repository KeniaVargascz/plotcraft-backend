-- CreateEnum
CREATE TYPE "VoteTargetType" AS ENUM ('NOVEL', 'CHARACTER', 'WORLD');

-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "votes_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "novels" ADD COLUMN     "kudos_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "votes_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "worlds" ADD COLUMN     "votes_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "novel_kudos" (
    "id" UUID NOT NULL,
    "novel_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "novel_kudos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "target_type" "VoteTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "novel_kudos_novel_id_idx" ON "novel_kudos"("novel_id");

-- CreateIndex
CREATE INDEX "novel_kudos_user_id_idx" ON "novel_kudos"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "novel_kudos_novel_id_user_id_key" ON "novel_kudos"("novel_id", "user_id");

-- CreateIndex
CREATE INDEX "votes_target_type_target_id_idx" ON "votes"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "votes_user_id_idx" ON "votes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "votes_user_id_target_type_target_id_key" ON "votes"("user_id", "target_type", "target_id");

-- AddForeignKey
ALTER TABLE "novel_kudos" ADD CONSTRAINT "novel_kudos_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_kudos" ADD CONSTRAINT "novel_kudos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Custom: full-text search support
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS posts_tags_idx ON posts USING GIN(tags);
