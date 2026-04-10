CREATE TABLE "visual_boards" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "cover_url" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "linked_type" VARCHAR(50),
    "linked_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visual_boards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "visual_board_sections" (
    "id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visual_board_sections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "visual_board_items" (
    "id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,
    "caption" VARCHAR(300),
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visual_board_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "visual_boards_author_id_idx" ON "visual_boards"("author_id");
CREATE INDEX "visual_boards_linked_type_linked_id_idx" ON "visual_boards"("linked_type", "linked_id");
CREATE INDEX "visual_board_sections_board_id_idx" ON "visual_board_sections"("board_id");
CREATE UNIQUE INDEX "visual_board_sections_board_id_order_index_key" ON "visual_board_sections"("board_id", "order_index");
CREATE INDEX "visual_board_items_section_id_idx" ON "visual_board_items"("section_id");
CREATE UNIQUE INDEX "visual_board_items_section_id_order_index_key" ON "visual_board_items"("section_id", "order_index");

ALTER TABLE "visual_boards"
ADD CONSTRAINT "visual_boards_author_id_fkey"
FOREIGN KEY ("author_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "visual_board_sections"
ADD CONSTRAINT "visual_board_sections_board_id_fkey"
FOREIGN KEY ("board_id") REFERENCES "visual_boards"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "visual_board_items"
ADD CONSTRAINT "visual_board_items_section_id_fkey"
FOREIGN KEY ("section_id") REFERENCES "visual_board_sections"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
