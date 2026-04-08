-- Rename NovelRating enum value PG13 to T.
ALTER TYPE "NovelRating" RENAME VALUE 'PG13' TO 'T';
