-- Tabla de comentarios por capitulo (mismo patron que novel_comments).
CREATE TABLE "chapter_comments" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "chapter_id" UUID         NOT NULL,
  "author_id"  UUID         NOT NULL,
  "content"    TEXT         NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "chapter_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chapter_comments_chapter_id_created_at_idx"
  ON "chapter_comments" ("chapter_id", "created_at");
CREATE INDEX "chapter_comments_author_id_idx"
  ON "chapter_comments" ("author_id");

ALTER TABLE "chapter_comments"
  ADD CONSTRAINT "chapter_comments_chapter_id_fkey"
    FOREIGN KEY ("chapter_id") REFERENCES "chapters" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chapter_comments"
  ADD CONSTRAINT "chapter_comments_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
