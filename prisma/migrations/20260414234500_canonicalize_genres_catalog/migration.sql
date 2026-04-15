-- Canonical genres catalog for PlotCraft.
-- Keeps only the approved catalog, remaps legacy translated slugs,
-- preserves fanfiction auto-tagging, and removes non-canonical genres.

-- 1. Ensure canonical genre rows exist with the expected labels.
INSERT INTO "genres" ("id", "slug", "label")
VALUES
  (gen_random_uuid(), 'fantasia', 'Fantasía'),
  (gen_random_uuid(), 'romance', 'Romance'),
  (gen_random_uuid(), 'ciencia-ficcion', 'Ciencia ficción'),
  (gen_random_uuid(), 'misterio', 'Misterio'),
  (gen_random_uuid(), 'thriller', 'Thriller'),
  (gen_random_uuid(), 'terror', 'Terror'),
  (gen_random_uuid(), 'drama', 'Drama'),
  (gen_random_uuid(), 'aventura', 'Aventura'),
  (gen_random_uuid(), 'accion', 'Acción'),
  (gen_random_uuid(), 'distopia', 'Distopía'),
  (gen_random_uuid(), 'historica', 'Histórica'),
  (gen_random_uuid(), 'paranormal', 'Paranormal'),
  (gen_random_uuid(), 'suspenso', 'Suspenso'),
  (gen_random_uuid(), 'comedia', 'Comedia'),
  (gen_random_uuid(), 'isekai', 'Isekai'),
  (gen_random_uuid(), 'fanfiction', 'Fanfiction')
ON CONFLICT ("slug") DO UPDATE
SET "label" = EXCLUDED."label";

-- 2. Remap legacy equivalent slugs to canonical slugs inside novel_genres.
WITH slug_mapping AS (
  SELECT * FROM (
    VALUES
      ('fantasy', 'fantasia'),
      ('sci-fi', 'ciencia-ficcion'),
      ('mystery', 'misterio'),
      ('horror', 'terror'),
      ('adventure', 'aventura'),
      ('historical', 'historica'),
      ('dystopia', 'distopia')
  ) AS m(old_slug, canonical_slug)
),
legacy_links AS (
  SELECT
    ng."novel_id",
    cg."id" AS canonical_genre_id
  FROM "novel_genres" ng
  INNER JOIN "genres" lg
    ON lg."id" = ng."genre_id"
  INNER JOIN slug_mapping sm
    ON sm.old_slug = lg."slug"
  INNER JOIN "genres" cg
    ON cg."slug" = sm.canonical_slug
)
INSERT INTO "novel_genres" ("novel_id", "genre_id")
SELECT ll."novel_id", ll.canonical_genre_id
FROM legacy_links ll
ON CONFLICT ("novel_id", "genre_id") DO NOTHING;

-- 3. Remove links pointing to genres that are not part of the canonical catalog.
DELETE FROM "novel_genres" ng
USING "genres" g
WHERE g."id" = ng."genre_id"
  AND g."slug" NOT IN (
    'fantasia',
    'romance',
    'ciencia-ficcion',
    'misterio',
    'thriller',
    'terror',
    'drama',
    'aventura',
    'accion',
    'distopia',
    'historica',
    'paranormal',
    'suspenso',
    'comedia',
    'isekai',
    'fanfiction'
  );

-- 4. Drop non-canonical genre rows from the catalog.
DELETE FROM "genres"
WHERE "slug" NOT IN (
  'fantasia',
  'romance',
  'ciencia-ficcion',
  'misterio',
  'thriller',
  'terror',
  'drama',
  'aventura',
  'accion',
  'distopia',
  'historica',
  'paranormal',
  'suspenso',
  'comedia',
  'isekai',
  'fanfiction'
);
