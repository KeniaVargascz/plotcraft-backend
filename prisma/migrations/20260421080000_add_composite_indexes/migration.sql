-- Partial index: public novels sorted by date (novel listings, discovery)
CREATE INDEX IF NOT EXISTS idx_novels_public_created
  ON novels(created_at DESC)
  WHERE is_public = true AND status != 'DRAFT';

-- Partial index: public characters by world (character catalog filtered by world)
CREATE INDEX IF NOT EXISTS idx_characters_public_world
  ON characters(world_id, created_at DESC)
  WHERE is_public = true;

-- Composite index: characters by author for profile pages
CREATE INDEX IF NOT EXISTS idx_characters_author_public
  ON characters(author_id, is_public, created_at DESC);
