import { ChapterStatus, Prisma } from '@prisma/client';

/**
 * Proyección ligera para listados y tarjetas de novelas.
 * Excluye relaciones pesadas (worlds, characters, pairings) que solo se
 * necesitan en la vista de detalle.
 */
export function novelCardInclude(viewerId?: string | null): Prisma.NovelInclude {
  return {
    author: {
      include: { profile: true },
    },
    language: {
      select: { id: true, code: true, name: true, description: true },
    },
    genres: {
      include: { genre: true },
    },
    romanceGenres: {
      include: {
        romanceGenre: { select: { id: true, slug: true, label: true } },
      },
    },
    novelWarnings: {
      include: {
        warning: { select: { id: true, slug: true, label: true } },
      },
    },
    likes: viewerId
      ? { where: { userId: viewerId }, select: { id: true } }
      : false,
    bookmarks: viewerId
      ? { where: { userId: viewerId }, select: { id: true } }
      : false,
    readingProgress: viewerId
      ? {
          where: { userId: viewerId },
          include: {
            chapter: {
              select: { id: true, slug: true, title: true, order: true },
            },
          },
        }
      : false,
    chapters: {
      where: { status: ChapterStatus.PUBLISHED },
      select: { id: true },
    },
    linkedCommunity: {
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        coverUrl: true,
        description: true,
      },
    },
    seriesNovels: {
      include: {
        series: {
          select: {
            id: true,
            title: true,
            slug: true,
            type: true,
            status: true,
            _count: { select: { novels: true } },
          },
        },
      },
    },
    pairings: {
      orderBy: { sortOrder: 'asc' as const },
      include: {
        characterA: { select: { id: true, name: true, slug: true } },
        characterB: { select: { id: true, name: true, slug: true } },
      },
    },
    _count: {
      select: {
        chapters: true,
        likes: true,
        bookmarks: true,
        novelWorlds: true,
        novelCharacters: true,
        novelComments: { where: { deletedAt: null } },
      },
    },
  };
}

/**
 * Proyección completa para la página de detalle de una novela.
 * Incluye chapters, worlds, characters y pairings.
 */
export function novelDetailInclude(
  viewerId?: string | null,
  includeDrafts = false,
): Prisma.NovelInclude {
  return {
    ...novelCardInclude(viewerId),
    chapters: {
      where: includeDrafts ? undefined : { status: ChapterStatus.PUBLISHED },
      orderBy: { order: 'asc' as const },
      select: {
        id: true,
        title: true,
        slug: true,
        order: true,
        status: true,
        wordCount: true,
        publishedAt: true,
        updatedAt: true,
      },
    },
    novelWorlds: {
      include: {
        world: {
          include: {
            author: { include: { profile: true } },
          },
        },
      },
    },
    novelCharacters: {
      include: {
        character: {
          include: {
            author: { include: { profile: true } },
            world: {
              select: {
                id: true,
                name: true,
                slug: true,
                visibility: true,
              },
            },
          },
        },
        communityCharacter: true,
      },
    },
  };
}
