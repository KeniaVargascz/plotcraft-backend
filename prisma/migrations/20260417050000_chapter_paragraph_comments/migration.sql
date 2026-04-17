-- AlterTable
ALTER TABLE "chapter_comments" ADD COLUMN "anchor_id" TEXT;
ALTER TABLE "chapter_comments" ADD COLUMN "quoted_text" TEXT;
ALTER TABLE "chapter_comments" ADD COLUMN "start_offset" INTEGER;
ALTER TABLE "chapter_comments" ADD COLUMN "end_offset" INTEGER;

-- CreateIndex
CREATE INDEX "chapter_comments_chapter_id_anchor_id_idx" ON "chapter_comments"("chapter_id", "anchor_id");
