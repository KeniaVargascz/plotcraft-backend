type CharacterData = {
  id: string;
  name: string;
  slug: string;
  alias: string[];
  role: string;
  status: string;
  age: string | null;
  appearance: string | null;
  personality: string | null;
  motivations: string | null;
  fears: string | null;
  strengths: string | null;
  weaknesses: string | null;
  backstory: string | null;
  arc: string | null;
  avatarUrl: string | null;
  isPublic: boolean;
  tags: string[];
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type RelationshipData = {
  id: string;
  type: string;
  description: string | null;
  isMutual: boolean;
  targetName: string;
  targetSlug: string;
};

type NovelData = {
  id: string;
  title: string;
  slug: string;
  roleInNovel: string | null;
};

export function formatCharacterJson(
  character: CharacterData,
  relationships: RelationshipData[],
  novels: NovelData[],
): string {
  const payload = {
    exportedAt: new Date().toISOString(),
    character: {
      id: character.id,
      name: character.name,
      slug: character.slug,
      alias: character.alias,
      role: character.role,
      status: character.status,
      age: character.age,
      appearance: character.appearance,
      personality: character.personality,
      motivations: character.motivations,
      fears: character.fears,
      strengths: character.strengths,
      weaknesses: character.weaknesses,
      backstory: character.backstory,
      arc: character.arc,
      avatarUrl: character.avatarUrl,
      isPublic: character.isPublic,
      tags: character.tags,
      metadata: character.metadata,
      createdAt: character.createdAt.toISOString(),
      updatedAt: character.updatedAt.toISOString(),
    },
    relationships,
    novels,
  };

  return JSON.stringify(payload, null, 2);
}
