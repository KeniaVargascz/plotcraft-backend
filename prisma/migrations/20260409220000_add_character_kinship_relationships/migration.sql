CREATE TYPE "CharacterRelationshipCategory" AS ENUM ('KINSHIP', 'OTHER');

CREATE TYPE "CharacterKinshipType" AS ENUM (
    'PARENT',
    'CHILD',
    'SIBLING',
    'GRANDPARENT',
    'GRANDCHILD',
    'UNCLE_AUNT',
    'NIECE_NEPHEW',
    'COUSIN',
    'SPOUSE',
    'STEP_PARENT',
    'STEP_CHILD',
    'GUARDIAN',
    'WARD'
);

ALTER TABLE "character_relationships"
ADD COLUMN "category" "CharacterRelationshipCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN "kinship_type" "CharacterKinshipType",
ADD COLUMN "relationship_group_id" UUID;

CREATE INDEX "character_relationships_source_id_category_idx"
ON "character_relationships"("source_id", "category");

CREATE INDEX "character_relationships_target_id_category_idx"
ON "character_relationships"("target_id", "category");

CREATE INDEX "character_relationships_relationship_group_id_idx"
ON "character_relationships"("relationship_group_id");
