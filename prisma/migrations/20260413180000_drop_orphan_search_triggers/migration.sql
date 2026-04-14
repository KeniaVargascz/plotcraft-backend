-- Drop orphan triggers that reference the removed search_vector columns.
-- The columns were dropped in 20260406013347_add_performance_indexes but
-- the triggers created in 20260403012000_add_search_indexes were not removed.

DROP TRIGGER IF EXISTS novels_search_vector_trigger ON novels;
DROP TRIGGER IF EXISTS worlds_search_vector_trigger ON worlds;
DROP TRIGGER IF EXISTS characters_search_vector_trigger ON characters;
DROP TRIGGER IF EXISTS profiles_search_vector_trigger ON profiles;
DROP TRIGGER IF EXISTS posts_search_vector_trigger ON posts;

DROP FUNCTION IF EXISTS plotcraft_refresh_novels_search_vector();
DROP FUNCTION IF EXISTS plotcraft_refresh_worlds_search_vector();
DROP FUNCTION IF EXISTS plotcraft_refresh_characters_search_vector();
DROP FUNCTION IF EXISTS plotcraft_refresh_profiles_search_vector();
DROP FUNCTION IF EXISTS plotcraft_refresh_posts_search_vector();
