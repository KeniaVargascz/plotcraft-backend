type WorldData = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  setting: string | null;
  magicSystem: string | null;
  rules: string | null;
  genre: string | null;
  visibility: string;
  tags: string[];
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type LocationData = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  isNotable: boolean;
};

type CharacterData = {
  id: string;
  name: string;
  slug: string;
  role: string;
  status: string;
  age: string | null;
  appearance: string | null;
  personality: string | null;
  backstory: string | null;
};

type WbCategoryData = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  color: string | null;
  fieldSchema: unknown;
  entries: {
    id: string;
    title: string;
    slug: string;
    fields: unknown;
  }[];
};

export function formatWorldJson(
  world: WorldData,
  locations: LocationData[],
  characters: CharacterData[],
  wbCategories: WbCategoryData[],
): string {
  const payload = {
    exportedAt: new Date().toISOString(),
    world: {
      id: world.id,
      name: world.name,
      slug: world.slug,
      tagline: world.tagline,
      description: world.description,
      setting: world.setting,
      magicSystem: world.magicSystem,
      rules: world.rules,
      genre: world.genre,
      visibility: world.visibility,
      tags: world.tags,
      metadata: world.metadata,
      createdAt: world.createdAt.toISOString(),
      updatedAt: world.updatedAt.toISOString(),
    },
    locations,
    characters,
    wbCategories: wbCategories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon,
      description: cat.description,
      color: cat.color,
      fieldSchema: cat.fieldSchema,
      entries: cat.entries,
    })),
  };

  return JSON.stringify(payload, null, 2);
}
