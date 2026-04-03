CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE novels ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION plotcraft_refresh_novels_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('spanish', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(NEW.synopsis, '')), 'B') ||
    setweight(to_tsvector('spanish', array_to_string(NEW.tags, ' ')), 'C');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION plotcraft_refresh_worlds_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('spanish', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(NEW.tagline, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(NEW.description, '')), 'C') ||
    setweight(to_tsvector('spanish', array_to_string(NEW.tags, ' ')), 'C');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION plotcraft_refresh_characters_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('spanish', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('spanish', array_to_string(NEW.alias, ' ')), 'B') ||
    setweight(to_tsvector('spanish', array_to_string(NEW.tags, ' ')), 'C');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION plotcraft_refresh_profiles_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('spanish', coalesce(NEW.display_name, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(NEW.bio, '')), 'B');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION plotcraft_refresh_posts_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := to_tsvector('spanish', coalesce(NEW.content, ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS novels_search_vector_trigger ON novels;
CREATE TRIGGER novels_search_vector_trigger
BEFORE INSERT OR UPDATE OF title, synopsis, tags ON novels
FOR EACH ROW
EXECUTE FUNCTION plotcraft_refresh_novels_search_vector();

DROP TRIGGER IF EXISTS worlds_search_vector_trigger ON worlds;
CREATE TRIGGER worlds_search_vector_trigger
BEFORE INSERT OR UPDATE OF name, tagline, description, tags ON worlds
FOR EACH ROW
EXECUTE FUNCTION plotcraft_refresh_worlds_search_vector();

DROP TRIGGER IF EXISTS characters_search_vector_trigger ON characters;
CREATE TRIGGER characters_search_vector_trigger
BEFORE INSERT OR UPDATE OF name, alias, tags ON characters
FOR EACH ROW
EXECUTE FUNCTION plotcraft_refresh_characters_search_vector();

DROP TRIGGER IF EXISTS profiles_search_vector_trigger ON profiles;
CREATE TRIGGER profiles_search_vector_trigger
BEFORE INSERT OR UPDATE OF display_name, bio ON profiles
FOR EACH ROW
EXECUTE FUNCTION plotcraft_refresh_profiles_search_vector();

DROP TRIGGER IF EXISTS posts_search_vector_trigger ON posts;
CREATE TRIGGER posts_search_vector_trigger
BEFORE INSERT OR UPDATE OF content ON posts
FOR EACH ROW
EXECUTE FUNCTION plotcraft_refresh_posts_search_vector();

UPDATE novels
SET search_vector =
  setweight(to_tsvector('spanish', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('spanish', coalesce(synopsis, '')), 'B') ||
  setweight(to_tsvector('spanish', array_to_string(tags, ' ')), 'C')
WHERE search_vector IS NULL;

UPDATE worlds
SET search_vector =
  setweight(to_tsvector('spanish', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('spanish', coalesce(tagline, '')), 'B') ||
  setweight(to_tsvector('spanish', coalesce(description, '')), 'C') ||
  setweight(to_tsvector('spanish', array_to_string(tags, ' ')), 'C')
WHERE search_vector IS NULL;

UPDATE characters
SET search_vector =
  setweight(to_tsvector('spanish', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('spanish', array_to_string(alias, ' ')), 'B') ||
  setweight(to_tsvector('spanish', array_to_string(tags, ' ')), 'C')
WHERE search_vector IS NULL;

UPDATE profiles
SET search_vector =
  setweight(to_tsvector('spanish', coalesce(display_name, '')), 'A') ||
  setweight(to_tsvector('spanish', coalesce(bio, '')), 'B')
WHERE search_vector IS NULL;

UPDATE posts
SET search_vector = to_tsvector('spanish', coalesce(content, ''))
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS novels_search_idx ON novels USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS worlds_search_idx ON worlds USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS characters_search_idx ON characters USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS profiles_search_idx ON profiles USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS users_username_trgm_idx ON users USING GIN(username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_email_trgm_idx ON users USING GIN(email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS posts_search_idx ON posts USING GIN(search_vector);

CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query VARCHAR(200) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS search_history_user_query_key
  ON search_history(user_id, query);

CREATE INDEX IF NOT EXISTS search_history_user_created_at_idx
  ON search_history(user_id, created_at DESC);
