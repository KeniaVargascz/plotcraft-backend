CREATE TABLE "cat_language" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "description" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_language_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cat_language_code_key" ON "cat_language"("code");

INSERT INTO "cat_language" ("code", "name", "description")
VALUES
    ('es', 'Español', 'Español'),
    ('en', 'Inglés', 'Inglés'),
    ('pt', 'Portugués', 'Portugués'),
    ('fr', 'Francés', 'Francés'),
    ('de', 'Alemán', 'Alemán'),
    ('it', 'Italiano', 'Italiano'),
    ('ja', 'Japonés', 'Japonés'),
    ('ko', 'Coreano', 'Coreano'),
    ('zh', 'Chino', 'Chino'),
    ('ru', 'Ruso', 'Ruso'),
    ('ar', 'Árabe', 'Árabe'),
    ('other', 'Otro', 'Otro')
ON CONFLICT ("code") DO NOTHING;

ALTER TABLE "novels" ADD COLUMN "language_id" UUID;

UPDATE "novels"
SET "language_id" = (
    SELECT "id"
    FROM "cat_language"
    WHERE "code" = 'es'
)
WHERE "language_id" IS NULL;

ALTER TABLE "novels" ALTER COLUMN "language_id" SET NOT NULL;

CREATE INDEX "novels_language_id_idx" ON "novels"("language_id");

ALTER TABLE "novels"
ADD CONSTRAINT "novels_language_id_fkey"
FOREIGN KEY ("language_id") REFERENCES "cat_language"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
