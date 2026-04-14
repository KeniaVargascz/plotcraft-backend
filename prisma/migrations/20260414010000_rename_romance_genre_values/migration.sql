-- Rename RomanceGenre enum values: BL->MM, GL->FF, HETEROSEXUAL->MF

-- Rename enum values (PostgreSQL 10+)
ALTER TYPE "RomanceGenre" RENAME VALUE 'BL' TO 'MM';
ALTER TYPE "RomanceGenre" RENAME VALUE 'GL' TO 'FF';
ALTER TYPE "RomanceGenre" RENAME VALUE 'HETEROSEXUAL' TO 'MF';
