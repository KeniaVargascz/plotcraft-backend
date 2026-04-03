-- CreateTable
CREATE TABLE "wb_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "world_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "icon" VARCHAR(10),
    "description" VARCHAR(500),
    "color" VARCHAR(20),
    "field_schema" JSONB NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wb_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wb_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "world_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "summary" VARCHAR(500),
    "content" TEXT,
    "cover_url" TEXT,
    "fields" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[],
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wb_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wb_entry_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "relation" VARCHAR(100) NOT NULL,
    "is_mutual" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wb_entry_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wb_categories_world_id_slug_key" ON "wb_categories"("world_id", "slug");

-- CreateIndex
CREATE INDEX "wb_categories_world_id_sort_order_idx" ON "wb_categories"("world_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "wb_entries_world_id_slug_key" ON "wb_entries"("world_id", "slug");

-- CreateIndex
CREATE INDEX "wb_entries_world_id_category_id_idx" ON "wb_entries"("world_id", "category_id");

-- CreateIndex
CREATE INDEX "wb_entries_author_id_idx" ON "wb_entries"("author_id");

-- CreateIndex
CREATE INDEX "wb_entries_world_id_is_public_idx" ON "wb_entries"("world_id", "is_public");

-- CreateIndex
CREATE UNIQUE INDEX "wb_entry_links_source_id_target_id_relation_key" ON "wb_entry_links"("source_id", "target_id", "relation");

-- CreateIndex
CREATE INDEX "wb_entry_links_source_id_idx" ON "wb_entry_links"("source_id");

-- CreateIndex
CREATE INDEX "wb_entry_links_target_id_idx" ON "wb_entry_links"("target_id");

-- AddForeignKey
ALTER TABLE "wb_categories" ADD CONSTRAINT "wb_categories_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wb_entries" ADD CONSTRAINT "wb_entries_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wb_entries" ADD CONSTRAINT "wb_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "wb_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wb_entries" ADD CONSTRAINT "wb_entries_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wb_entry_links" ADD CONSTRAINT "wb_entry_links_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "wb_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wb_entry_links" ADD CONSTRAINT "wb_entry_links_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "wb_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Immutable wrapper for building wb_entries search vector
CREATE OR REPLACE FUNCTION wb_entry_search_vector(
  p_name text,
  p_summary text,
  p_content text,
  p_tags text[]
) RETURNS tsvector AS $$
  SELECT
    setweight(to_tsvector('spanish', coalesce(p_name, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(p_summary, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(p_content, '')), 'C') ||
    setweight(to_tsvector('spanish', array_to_string(coalesce(p_tags, ARRAY[]::text[]), ' ')), 'C');
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- Full-text search vector
ALTER TABLE "wb_entries"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    wb_entry_search_vector(name, summary, content, tags)
  ) STORED;

CREATE INDEX IF NOT EXISTS "wb_entries_search_idx" ON "wb_entries" USING GIN("search_vector");
