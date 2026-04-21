import { createSlug } from '../../modules/novels/utils/slugify.util';
import { PrismaService } from '../../prisma/prisma.service';

type SlugModel =
  | 'novel'
  | 'chapter'
  | 'world'
  | 'character'
  | 'community'
  | 'forumThread'
  | 'wbEntry'
  | 'series'
  | 'communityForum';

interface UniqueSlugOptions {
  /** Base text to slugify */
  title: string;
  /** Prisma model to check against */
  model: SlugModel;
  /** Additional where clause for scoped uniqueness (e.g. { novelId }) */
  scope?: Record<string, unknown>;
  /** ID to exclude from collision check (for updates) */
  ignoreId?: string;
}

/**
 * Generates a unique slug with O(1) database queries instead of a while-loop.
 * Fetches all slugs with the same prefix in a single query, then picks the
 * next available numeric suffix.
 */
export async function generateUniqueSlug(
  prisma: PrismaService,
  options: UniqueSlugOptions,
): Promise<string> {
  const baseSlug = createSlug(options.title);
  if (!baseSlug) {
    throw new Error(`Cannot generate slug from: "${options.title}"`);
  }

  const where: Record<string, unknown> = {
    slug: { startsWith: baseSlug },
    ...(options.scope ?? {}),
  };

  if (options.ignoreId) {
    where.id = { not: options.ignoreId };
  }

  const existing: Array<{ slug: string }> = await (
    prisma[options.model] as any
  ).findMany({
    where,
    select: { slug: true },
  });

  if (!existing.length) return baseSlug;

  // Check if the exact base slug is free
  const slugSet = new Set(existing.map((e) => e.slug));
  if (!slugSet.has(baseSlug)) return baseSlug;

  // Find max numeric suffix
  const max = Math.max(
    1,
    ...existing.map((e) => {
      const suffix = e.slug.slice(baseSlug.length + 1);
      const num = parseInt(suffix, 10);
      return isNaN(num) ? 1 : num;
    }),
  );

  return `${baseSlug}-${max + 1}`;
}
