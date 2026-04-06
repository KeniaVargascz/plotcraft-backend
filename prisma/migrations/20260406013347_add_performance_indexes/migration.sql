/*
  Warnings:

  - You are about to drop the column `search_vector` on the `characters` table. All the data in the column will be lost.
  - You are about to drop the column `search_vector` on the `novels` table. All the data in the column will be lost.
  - You are about to drop the column `search_vector` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `search_vector` on the `profiles` table. All the data in the column will be lost.
  - You are about to drop the column `search_vector` on the `wb_entries` table. All the data in the column will be lost.
  - You are about to drop the column `search_vector` on the `worlds` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ForumCategory" AS ENUM ('GENERAL', 'FEEDBACK', 'WRITING_TIPS', 'WORLD_BUILDING', 'CHARACTERS', 'SHOWCASE', 'ANNOUNCEMENTS', 'HELP', 'OFF_TOPIC');

-- CreateEnum
CREATE TYPE "ThreadStatus" AS ENUM ('OPEN', 'CLOSED', 'PINNED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PollStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ForumReactionType" AS ENUM ('LIKE', 'HELPFUL', 'INSIGHTFUL', 'FUNNY');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_FOLLOWER', 'NEW_COMMENT', 'NEW_REACTION', 'NEW_REPLY', 'NEW_CHAPTER', 'NOVEL_MILESTONE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MarkerType" AS ENUM ('CITY', 'TOWN', 'VILLAGE', 'DUNGEON', 'LANDMARK', 'RUINS', 'TEMPLE', 'FORTRESS', 'PORT', 'MOUNTAIN', 'FOREST', 'CUSTOM');

-- DropForeignKey
ALTER TABLE "search_history" DROP CONSTRAINT "search_history_user_id_fkey";

-- DropIndex
DROP INDEX "characters_search_idx";

-- DropIndex
DROP INDEX "novels_search_idx";

-- DropIndex
DROP INDEX "posts_search_idx";

-- DropIndex
DROP INDEX "profiles_search_idx";

-- DropIndex
DROP INDEX "search_history_user_created_at_idx";

-- DropIndex
DROP INDEX "users_email_trgm_idx";

-- DropIndex
DROP INDEX "users_username_trgm_idx";

-- DropIndex
DROP INDEX "wb_entries_search_idx";

-- DropIndex
DROP INDEX "worlds_search_idx";

-- AlterTable
ALTER TABLE "characters" DROP COLUMN "search_vector";

-- AlterTable
ALTER TABLE "novels" DROP COLUMN "search_vector";

-- AlterTable
ALTER TABLE "posts" DROP COLUMN "search_vector";

-- AlterTable
ALTER TABLE "profiles" DROP COLUMN "search_vector";

-- AlterTable
ALTER TABLE "search_history" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "timeline_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "timelines" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wb_categories" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wb_entries" DROP COLUMN "search_vector",
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wb_entry_links" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "worlds" DROP COLUMN "search_vector";

-- AlterTable
ALTER TABLE "writing_projects" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "writing_tasks" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "forum_threads" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "category" "ForumCategory" NOT NULL DEFAULT 'GENERAL',
    "title" VARCHAR(300) NOT NULL,
    "slug" VARCHAR(320) NOT NULL,
    "content" TEXT NOT NULL,
    "status" "ThreadStatus" NOT NULL DEFAULT 'OPEN',
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "forum_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_thread_tags" (
    "thread_id" UUID NOT NULL,
    "tag" VARCHAR(50) NOT NULL,

    CONSTRAINT "forum_thread_tags_pkey" PRIMARY KEY ("thread_id","tag")
);

-- CreateTable
CREATE TABLE "forum_replies" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "is_solution" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "forum_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_reactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "thread_id" UUID,
    "reply_id" UUID,
    "reaction_type" "ForumReactionType" NOT NULL DEFAULT 'LIKE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_polls" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "question" VARCHAR(300) NOT NULL,
    "status" "PollStatus" NOT NULL DEFAULT 'OPEN',
    "closes_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_options" (
    "id" UUID NOT NULL,
    "poll_id" UUID NOT NULL,
    "text" VARCHAR(200) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_votes" (
    "id" UUID NOT NULL,
    "poll_id" UUID NOT NULL,
    "option_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_settings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "show_reading_activity" BOOLEAN NOT NULL DEFAULT true,
    "show_reading_lists" BOOLEAN NOT NULL DEFAULT true,
    "show_follows" BOOLEAN NOT NULL DEFAULT true,
    "show_stats" BOOLEAN NOT NULL DEFAULT true,
    "allow_messages" BOOLEAN NOT NULL DEFAULT true,
    "searchable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privacy_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "new_follower" BOOLEAN NOT NULL DEFAULT true,
    "new_comment_on_post" BOOLEAN NOT NULL DEFAULT true,
    "new_reaction_on_post" BOOLEAN NOT NULL DEFAULT false,
    "new_reply_in_thread" BOOLEAN NOT NULL DEFAULT true,
    "new_chapter_from_followed" BOOLEAN NOT NULL DEFAULT true,
    "novel_milestone" BOOLEAN NOT NULL DEFAULT true,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "url" VARCHAR(500),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novel_daily_snapshots" (
    "id" UUID NOT NULL,
    "novel_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "bookmarks" INTEGER NOT NULL DEFAULT 0,
    "new_readers" INTEGER NOT NULL DEFAULT 0,
    "chapters_read" INTEGER NOT NULL DEFAULT 0,
    "words_read" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "novel_daily_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "author_daily_snapshots" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "new_followers" INTEGER NOT NULL DEFAULT 0,
    "profile_views" INTEGER NOT NULL DEFAULT 0,
    "post_reactions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "author_daily_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world_maps" (
    "id" UUID NOT NULL,
    "world_id" UUID NOT NULL,
    "base_image_url" TEXT,
    "viewport" JSONB NOT NULL DEFAULT '{"x":0,"y":0,"zoom":1}',
    "canvas_width" INTEGER NOT NULL DEFAULT 2000,
    "canvas_height" INTEGER NOT NULL DEFAULT 1500,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "world_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "map_markers" (
    "id" UUID NOT NULL,
    "map_id" UUID NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "type" "MarkerType" NOT NULL DEFAULT 'CUSTOM',
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "description" VARCHAR(500),
    "icon" VARCHAR(10),
    "color" VARCHAR(20),
    "location_id" UUID,
    "wb_entry_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "map_markers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "map_regions" (
    "id" UUID NOT NULL,
    "map_id" UUID NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#8b5cf640',
    "border_color" TEXT NOT NULL DEFAULT '#8b5cf6',
    "points" JSONB NOT NULL,
    "description" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "map_regions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "forum_threads_slug_key" ON "forum_threads"("slug");

-- CreateIndex
CREATE INDEX "forum_threads_category_status_created_at_idx" ON "forum_threads"("category", "status", "created_at");

-- CreateIndex
CREATE INDEX "forum_threads_author_id_idx" ON "forum_threads"("author_id");

-- CreateIndex
CREATE INDEX "forum_threads_slug_idx" ON "forum_threads"("slug");

-- CreateIndex
CREATE INDEX "forum_thread_tags_tag_idx" ON "forum_thread_tags"("tag");

-- CreateIndex
CREATE INDEX "forum_replies_thread_id_created_at_idx" ON "forum_replies"("thread_id", "created_at");

-- CreateIndex
CREATE INDEX "forum_replies_author_id_idx" ON "forum_replies"("author_id");

-- CreateIndex
CREATE INDEX "forum_reactions_thread_id_idx" ON "forum_reactions"("thread_id");

-- CreateIndex
CREATE INDEX "forum_reactions_reply_id_idx" ON "forum_reactions"("reply_id");

-- CreateIndex
CREATE UNIQUE INDEX "forum_reactions_user_id_thread_id_reaction_type_key" ON "forum_reactions"("user_id", "thread_id", "reaction_type");

-- CreateIndex
CREATE UNIQUE INDEX "forum_reactions_user_id_reply_id_reaction_type_key" ON "forum_reactions"("user_id", "reply_id", "reaction_type");

-- CreateIndex
CREATE UNIQUE INDEX "forum_polls_thread_id_key" ON "forum_polls"("thread_id");

-- CreateIndex
CREATE INDEX "poll_options_poll_id_idx" ON "poll_options"("poll_id");

-- CreateIndex
CREATE INDEX "poll_votes_poll_id_idx" ON "poll_votes"("poll_id");

-- CreateIndex
CREATE INDEX "poll_votes_user_id_idx" ON "poll_votes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "poll_votes_poll_id_user_id_key" ON "poll_votes"("poll_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "privacy_settings_user_id_key" ON "privacy_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "novel_daily_snapshots_novel_id_date_idx" ON "novel_daily_snapshots"("novel_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "novel_daily_snapshots_novel_id_date_key" ON "novel_daily_snapshots"("novel_id", "date");

-- CreateIndex
CREATE INDEX "author_daily_snapshots_author_id_date_idx" ON "author_daily_snapshots"("author_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "author_daily_snapshots_author_id_date_key" ON "author_daily_snapshots"("author_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "world_maps_world_id_key" ON "world_maps"("world_id");

-- CreateIndex
CREATE INDEX "map_markers_map_id_idx" ON "map_markers"("map_id");

-- CreateIndex
CREATE INDEX "map_regions_map_id_idx" ON "map_regions"("map_id");

-- CreateIndex
CREATE INDEX "chapters_slug_idx" ON "chapters"("slug");

-- CreateIndex
CREATE INDEX "posts_author_id_created_at_idx" ON "posts"("author_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "search_history_user_id_created_at_idx" ON "search_history"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "wb_entries_world_id_slug_idx" ON "wb_entries"("world_id", "slug");

-- AddForeignKey
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_thread_tags" ADD CONSTRAINT "forum_thread_tags_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "forum_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "forum_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reactions" ADD CONSTRAINT "forum_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reactions" ADD CONSTRAINT "forum_reactions_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "forum_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reactions" ADD CONSTRAINT "forum_reactions_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "forum_replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_polls" ADD CONSTRAINT "forum_polls_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "forum_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "forum_polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "forum_polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "poll_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privacy_settings" ADD CONSTRAINT "privacy_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_daily_snapshots" ADD CONSTRAINT "novel_daily_snapshots_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_daily_snapshots" ADD CONSTRAINT "author_daily_snapshots_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_maps" ADD CONSTRAINT "world_maps_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_markers" ADD CONSTRAINT "map_markers_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "world_maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_markers" ADD CONSTRAINT "map_markers_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "world_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_regions" ADD CONSTRAINT "map_regions_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "world_maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "search_history_user_query_key" RENAME TO "search_history_user_id_query_key";
