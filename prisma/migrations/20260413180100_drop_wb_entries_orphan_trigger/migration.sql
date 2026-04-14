-- Drop orphan wb_entries trigger and functions missed in previous cleanup.
-- The search_vector column was dropped from wb_entries in 20260406013347
-- but the trigger and functions from 20260403040000_add_worldbuilding survived.

DROP TRIGGER IF EXISTS wb_entries_search_vector_trigger ON wb_entries;

DROP FUNCTION IF EXISTS wb_entry_search_vector(text, text, text, text[]);
DROP FUNCTION IF EXISTS plotcraft_refresh_wb_entries_search_vector();
