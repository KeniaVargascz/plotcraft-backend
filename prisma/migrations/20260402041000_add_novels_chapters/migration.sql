-- CreateEnum
CREATE TYPE "NovelStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NovelRating" AS ENUM ('G', 'PG', 'PG13', 'R', 'EXPLICIT');

-- CreateEnum
CREATE TYPE "ChapterStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SCHEDULED');

-- CreateTable
CREATE TABLE "genres" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "label" VARCHAR(120) NOT NULL,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novels" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "synopsis" TEXT,
    "cover_url" TEXT,
    "status" "NovelStatus" NOT NULL DEFAULT 'DRAFT',
    "rating" "NovelRating" NOT NULL DEFAULT 'G',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "novels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novel_genres" (
    "novel_id" UUID NOT NULL,
    "genre_id" UUID NOT NULL,

    CONSTRAINT "novel_genres_pkey" PRIMARY KEY ("novel_id","genre_id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" UUID NOT NULL,
    "novel_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "slug" VARCHAR(320) NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "ChapterStatus" NOT NULL DEFAULT 'DRAFT',
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "content_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novel_likes" (
    "id" UUID NOT NULL,
    "novel_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "novel_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novel_bookmarks" (
    "id" UUID NOT NULL,
    "novel_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "novel_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "genres_slug_key" ON "genres"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "novels_slug_key" ON "novels"("slug");

-- CreateIndex
CREATE INDEX "novels_author_id_idx" ON "novels"("author_id");

-- CreateIndex
CREATE INDEX "novels_slug_idx" ON "novels"("slug");

-- CreateIndex
CREATE INDEX "novels_status_is_public_idx" ON "novels"("status", "is_public");

-- CreateIndex
CREATE INDEX "novels_created_at_idx" ON "novels"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_novel_id_slug_key" ON "chapters"("novel_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_novel_id_order_key" ON "chapters"("novel_id", "order");

-- CreateIndex
CREATE INDEX "chapters_novel_id_status_idx" ON "chapters"("novel_id", "status");

-- CreateIndex
CREATE INDEX "chapters_novel_id_order_idx" ON "chapters"("novel_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "novel_likes_novel_id_user_id_key" ON "novel_likes"("novel_id", "user_id");

-- CreateIndex
CREATE INDEX "novel_likes_novel_id_idx" ON "novel_likes"("novel_id");

-- CreateIndex
CREATE INDEX "novel_likes_user_id_idx" ON "novel_likes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "novel_bookmarks_novel_id_user_id_key" ON "novel_bookmarks"("novel_id", "user_id");

-- CreateIndex
CREATE INDEX "novel_bookmarks_user_id_idx" ON "novel_bookmarks"("user_id");

-- AddForeignKey
ALTER TABLE "novels" ADD CONSTRAINT "novels_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_genres" ADD CONSTRAINT "novel_genres_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_genres" ADD CONSTRAINT "novel_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_likes" ADD CONSTRAINT "novel_likes_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_likes" ADD CONSTRAINT "novel_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_bookmarks" ADD CONSTRAINT "novel_bookmarks_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_bookmarks" ADD CONSTRAINT "novel_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
