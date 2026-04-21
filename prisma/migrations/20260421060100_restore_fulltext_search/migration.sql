-- Restore tsvector columns
ALTER TABLE novels ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Recreate triggers
CREATE OR REPLACE FUNCTION plotcraft_novels_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('spanish', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(NEW.synopsis, '')), 'B') ||
    setweight(to_tsvector('spanish', array_to_string(NEW.tags, ' ')), 'C');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION plotcraft_worlds_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('spanish', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(NEW.tagline, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(NEW.description, '')), 'C') ||
    setweight(to_tsvector('spanish', array_to_string(NEW.tags, ' ')), 'C');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION plotcraft_characters_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('spanish', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('spanish', array_to_string(NEW.alias, ' ')), 'B') ||
    setweight(to_tsvector('spanish', array_to_string(NEW.tags, ' ')), 'C');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION plotcraft_posts_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('spanish', coalesce(NEW.content, ''));
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trg_novels_search ON novels;
CREATE TRIGGER trg_novels_search
BEFORE INSERT OR UPDATE OF title, synopsis, tags ON novels
FOR EACH ROW EXECUTE FUNCTION plotcraft_novels_search_vector();

DROP TRIGGER IF EXISTS trg_worlds_search ON worlds;
CREATE TRIGGER trg_worlds_search
BEFORE INSERT OR UPDATE OF name, tagline, description, tags ON worlds
FOR EACH ROW EXECUTE FUNCTION plotcraft_worlds_search_vector();

DROP TRIGGER IF EXISTS trg_characters_search ON characters;
CREATE TRIGGER trg_characters_search
BEFORE INSERT OR UPDATE OF name, alias, tags ON characters
FOR EACH ROW EXECUTE FUNCTION plotcraft_characters_search_vector();

DROP TRIGGER IF EXISTS trg_posts_search ON posts;
CREATE TRIGGER trg_posts_search
BEFORE INSERT OR UPDATE OF content ON posts
FOR EACH ROW EXECUTE FUNCTION plotcraft_posts_search_vector();

-- GIN indexes for full-text search
CREATE INDEX IF NOT EXISTS idx_novels_search ON novels USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_worlds_search ON worlds USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_characters_search ON characters USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_posts_search ON posts USING GIN(search_vector);

-- Trigram indexes for ILIKE fallback
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_novels_title_trgm ON novels USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_worlds_name_trgm ON worlds USING GIN(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_characters_name_trgm ON characters USING GIN(name gin_trgm_ops);

-- Backfill existing rows
UPDATE novels SET search_vector =
  setweight(to_tsvector('spanish', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('spanish', coalesce(synopsis, '')), 'B') ||
  setweight(to_tsvector('spanish', array_to_string(tags, ' ')), 'C')
WHERE search_vector IS NULL;

UPDATE worlds SET search_vector =
  setweight(to_tsvector('spanish', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('spanish', coalesce(tagline, '')), 'B') ||
  setweight(to_tsvector('spanish', coalesce(description, '')), 'C') ||
  setweight(to_tsvector('spanish', array_to_string(tags, ' ')), 'C')
WHERE search_vector IS NULL;

UPDATE characters SET search_vector =
  setweight(to_tsvector('spanish', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('spanish', array_to_string(alias, ' ')), 'B') ||
  setweight(to_tsvector('spanish', array_to_string(tags, ' ')), 'C')
WHERE search_vector IS NULL;

UPDATE posts SET search_vector = to_tsvector('spanish', coalesce(content, ''))
WHERE search_vector IS NULL;
