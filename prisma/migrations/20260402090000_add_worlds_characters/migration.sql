-- CreateEnum
CREATE TYPE "WorldVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "CharacterRole" AS ENUM ('PROTAGONIST', 'ANTAGONIST', 'SECONDARY', 'MENTOR', 'ALLY', 'RIVAL', 'NEUTRAL', 'BACKGROUND');

-- CreateEnum
CREATE TYPE "CharacterStatus" AS ENUM ('ALIVE', 'DECEASED', 'UNKNOWN', 'UNDEAD', 'TRANSFORMED');

-- AlterTable
ALTER TABLE "novels" ALTER COLUMN "tags" DROP DEFAULT,
ALTER COLUMN "warnings" DROP DEFAULT;

-- CreateTable
CREATE TABLE "worlds" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "tagline" VARCHAR(300),
    "description" TEXT,
    "setting" TEXT,
    "magic_system" TEXT,
    "rules" TEXT,
    "cover_url" TEXT,
    "map_url" TEXT,
    "visibility" "WorldVisibility" NOT NULL DEFAULT 'PRIVATE',
    "tags" TEXT[],
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worlds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world_locations" (
    "id" UUID NOT NULL,
    "world_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "is_notable" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "world_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novel_worlds" (
    "novel_id" UUID NOT NULL,
    "world_id" UUID NOT NULL,

    CONSTRAINT "novel_worlds_pkey" PRIMARY KEY ("novel_id","world_id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "world_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "alias" TEXT[],
    "role" "CharacterRole" NOT NULL DEFAULT 'SECONDARY',
    "status" "CharacterStatus" NOT NULL DEFAULT 'ALIVE',
    "age" VARCHAR(80),
    "appearance" TEXT,
    "personality" TEXT,
    "motivations" TEXT,
    "fears" TEXT,
    "strengths" TEXT,
    "weaknesses" TEXT,
    "backstory" TEXT,
    "arc" TEXT,
    "avatar_url" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_relationships" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "is_mutual" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novel_characters" (
    "novel_id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "role_in_novel" "CharacterRole",

    CONSTRAINT "novel_characters_pkey" PRIMARY KEY ("novel_id","character_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "worlds_slug_key" ON "worlds"("slug");

-- CreateIndex
CREATE INDEX "worlds_author_id_idx" ON "worlds"("author_id");

-- CreateIndex
CREATE INDEX "worlds_slug_idx" ON "worlds"("slug");

-- CreateIndex
CREATE INDEX "worlds_visibility_idx" ON "worlds"("visibility");

-- CreateIndex
CREATE INDEX "world_locations_world_id_idx" ON "world_locations"("world_id");

-- CreateIndex
CREATE INDEX "novel_worlds_novel_id_idx" ON "novel_worlds"("novel_id");

-- CreateIndex
CREATE INDEX "novel_worlds_world_id_idx" ON "novel_worlds"("world_id");

-- CreateIndex
CREATE INDEX "characters_author_id_idx" ON "characters"("author_id");

-- CreateIndex
CREATE INDEX "characters_world_id_idx" ON "characters"("world_id");

-- CreateIndex
CREATE UNIQUE INDEX "characters_author_id_slug_key" ON "characters"("author_id", "slug");

-- CreateIndex
CREATE INDEX "character_relationships_source_id_idx" ON "character_relationships"("source_id");

-- CreateIndex
CREATE INDEX "character_relationships_target_id_idx" ON "character_relationships"("target_id");

-- CreateIndex
CREATE UNIQUE INDEX "character_relationships_source_id_target_id_type_key" ON "character_relationships"("source_id", "target_id", "type");

-- CreateIndex
CREATE INDEX "novel_characters_novel_id_idx" ON "novel_characters"("novel_id");

-- CreateIndex
CREATE INDEX "novel_characters_character_id_idx" ON "novel_characters"("character_id");

-- AddForeignKey
ALTER TABLE "worlds" ADD CONSTRAINT "worlds_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_locations" ADD CONSTRAINT "world_locations_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_worlds" ADD CONSTRAINT "novel_worlds_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_worlds" ADD CONSTRAINT "novel_worlds_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_characters" ADD CONSTRAINT "novel_characters_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_characters" ADD CONSTRAINT "novel_characters_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
