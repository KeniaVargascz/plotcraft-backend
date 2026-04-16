-- Romance genre catalog migration: convert enum array to catalog table + join table

-- 1. Create catalog table
CREATE TABLE "cat_romance_genre" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "slug" VARCHAR(40) NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cat_romance_genre_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cat_romance_genre_slug_key" ON "cat_romance_genre"("slug");

-- 2. Seed catalog with the four canonical values
INSERT INTO "cat_romance_genre" ("slug", "label") VALUES
  ('mm', 'M/M'),
  ('mf', 'M/F'),
  ('ff', 'F/F'),
  ('other', 'Otros');

-- 3. Create join table
CREATE TABLE "novel_romance_genres" (
  "novel_id" UUID NOT NULL,
  "romance_genre_id" UUID NOT NULL,
  CONSTRAINT "novel_romance_genres_pkey" PRIMARY KEY ("novel_id", "romance_genre_id")
);

CREATE INDEX "novel_romance_genres_romance_genre_id_idx" ON "novel_romance_genres"("romance_genre_id");

ALTER TABLE "novel_romance_genres"
  ADD CONSTRAINT "novel_romance_genres_novel_id_fkey"
  FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "novel_romance_genres"
  ADD CONSTRAINT "novel_romance_genres_romance_genre_id_fkey"
  FOREIGN KEY ("romance_genre_id") REFERENCES "cat_romance_genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Migrate existing array data to join table rows
INSERT INTO "novel_romance_genres" ("novel_id", "romance_genre_id")
SELECT n."id", c."id"
FROM "novels" n
CROSS JOIN LATERAL unnest(n."romance_genres") AS rg(value)
JOIN "cat_romance_genre" c ON c."slug" = LOWER(rg.value::text)
ON CONFLICT DO NOTHING;

-- 5. Drop old column and enum type
ALTER TABLE "novels" DROP COLUMN "romance_genres";
DROP TYPE "RomanceGenre";
