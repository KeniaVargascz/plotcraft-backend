-- CreateEnum
CREATE TYPE "TimelineEventType" AS ENUM ('WORLD_EVENT', 'STORY_EVENT', 'CHARACTER_ARC', 'CHAPTER_EVENT', 'LORE_EVENT', 'NOTE');
CREATE TYPE "TimelineEventRelevance" AS ENUM ('CRITICAL', 'MAJOR', 'MINOR', 'BACKGROUND');
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "TaskStatus" AS ENUM ('BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE');
CREATE TYPE "TaskType" AS ENUM ('CHAPTER', 'CHARACTER', 'WORLDBUILDING', 'PLANNING', 'REVISION', 'RESEARCH', 'PUBLICATION', 'OTHER');

-- CreateTable: timelines
CREATE TABLE "timelines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "author_id" UUID NOT NULL,
    "novel_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "timelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable: timeline_events
CREATE TABLE "timeline_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "timeline_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "type" "TimelineEventType" NOT NULL DEFAULT 'STORY_EVENT',
    "relevance" "TimelineEventRelevance" NOT NULL DEFAULT 'MINOR',
    "date_label" VARCHAR(100),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "color" VARCHAR(20),
    "tags" TEXT[],
    "chapter_id" UUID,
    "character_id" UUID,
    "world_id" UUID,
    "wb_entry_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable: writing_projects
CREATE TABLE "writing_projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "author_id" UUID NOT NULL,
    "novel_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "color" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "writing_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable: writing_tasks
CREATE TABLE "writing_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "type" "TaskType" NOT NULL DEFAULT 'OTHER',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'BACKLOG',
    "due_date" TIMESTAMP(3),
    "target_words" INTEGER,
    "actual_words" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[],
    "chapter_id" UUID,
    "character_id" UUID,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "writing_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timelines_author_id_idx" ON "timelines"("author_id");
CREATE UNIQUE INDEX "timelines_author_id_novel_id_key" ON "timelines"("author_id", "novel_id");

CREATE INDEX "timeline_events_timeline_id_sort_order_idx" ON "timeline_events"("timeline_id", "sort_order");
CREATE INDEX "timeline_events_author_id_idx" ON "timeline_events"("author_id");
CREATE INDEX "timeline_events_type_idx" ON "timeline_events"("type");
CREATE INDEX "timeline_events_character_id_idx" ON "timeline_events"("character_id");

CREATE INDEX "writing_projects_author_id_idx" ON "writing_projects"("author_id");
CREATE INDEX "writing_projects_novel_id_idx" ON "writing_projects"("novel_id");

CREATE INDEX "writing_tasks_project_id_status_sort_order_idx" ON "writing_tasks"("project_id", "status", "sort_order");
CREATE INDEX "writing_tasks_author_id_idx" ON "writing_tasks"("author_id");
CREATE INDEX "writing_tasks_due_date_idx" ON "writing_tasks"("due_date");
CREATE INDEX "writing_tasks_status_idx" ON "writing_tasks"("status");

-- AddForeignKey
ALTER TABLE "timelines" ADD CONSTRAINT "timelines_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timelines" ADD CONSTRAINT "timelines_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_timeline_id_fkey" FOREIGN KEY ("timeline_id") REFERENCES "timelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_wb_entry_id_fkey" FOREIGN KEY ("wb_entry_id") REFERENCES "wb_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "writing_projects" ADD CONSTRAINT "writing_projects_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "writing_projects" ADD CONSTRAINT "writing_projects_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "writing_tasks" ADD CONSTRAINT "writing_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "writing_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "writing_tasks" ADD CONSTRAINT "writing_tasks_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "writing_tasks" ADD CONSTRAINT "writing_tasks_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "writing_tasks" ADD CONSTRAINT "writing_tasks_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
