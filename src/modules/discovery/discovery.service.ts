import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { APP_CONFIG } from '../../config/constants';
import {
  CacheService,
  CACHE_SERVICE,
} from '../../common/services/cache.service';

const MV_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class DiscoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscoveryService.name);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  onModuleInit() {
    // Fire an initial refresh (non-blocking) then schedule periodic refreshes
    this.refreshMaterializedViews().catch((err) =>
      this.logger.warn(`Initial materialized view refresh failed: ${err.message}`),
    );
    this.refreshTimer = setInterval(() => {
      this.refreshMaterializedViews().catch((err) =>
        this.logger.warn(`Scheduled materialized view refresh failed: ${err.message}`),
      );
    }, MV_REFRESH_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async refreshMaterializedViews(): Promise<void> {
    this.logger.log('Refreshing materialized views...');
    await this.prisma.$executeRawUnsafe(
      `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trending_novels`,
    );
    await this.prisma.$executeRawUnsafe(
      `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trending_authors`,
    );
    await this.prisma.$executeRawUnsafe(
      `REFRESH MATERIALIZED VIEW mv_platform_stats`,
    );
    this.logger.log('Materialized views refreshed successfully');
  }

  async getSnapshot(refresh = false) {
    return this.fromCache('snapshot', refresh, async () => {
      const [
        trendingNovels,
        trendingWorlds,
        trendingCharacters,
        trendingAuthors,
        newReleases,
        genresSpotlight,
        stats,
        communityPosts,
      ] = await Promise.all([
        this.computeTrendingNovels(6),
        this.computeTrendingWorlds(4),
        this.computeTrendingCharacters(6),
        this.computeTrendingAuthors(4),
        this.computeNewReleases(6),
        this.computeGenresSpotlight(4, 3),
        this.computePlatformStats(),
        this.computeCommunityPosts(6),
      ]);

      return {
        trending: {
          novels: trendingNovels,
          worlds: trendingWorlds,
          characters: trendingCharacters,
          authors: trendingAuthors,
        },
        new_releases: newReleases,
        genres_spotlight: genresSpotlight,
        community_posts: communityPosts,
        stats,
      };
    });
  }

  async getTrendingNovels(refresh = false, limit = 10) {
    const items = await this.fromCache(
      `trending:novels:${limit}`,
      refresh,
      () => this.computeTrendingNovels(limit),
    );

    return {
      items,
      period: '72h' as const,
      generated_at: new Date().toISOString(),
    };
  }

  async getTrendingWorlds(refresh = false, limit = 8) {
    const items = await this.fromCache(
      `trending:worlds:${limit}`,
      refresh,
      () => this.computeTrendingWorlds(limit),
    );

    return {
      items,
      period: '72h' as const,
      generated_at: new Date().toISOString(),
    };
  }

  async getTrendingCharacters(refresh = false, limit = 8) {
    const items = await this.fromCache(
      `trending:characters:${limit}`,
      refresh,
      () => this.computeTrendingCharacters(limit),
    );

    return {
      items,
      period: '72h' as const,
      generated_at: new Date().toISOString(),
    };
  }

  async getTrendingAuthors(refresh = false, limit = 8) {
    const items = await this.fromCache(
      `trending:authors:${limit}`,
      refresh,
      () => this.computeTrendingAuthors(limit),
    );

    return {
      items,
      period: '7d' as const,
      generated_at: new Date().toISOString(),
    };
  }

  async getFeatured(refresh = false) {
    return this.fromCache('featured', refresh, async () => {
      const [novels, worlds, authors, posts] = await Promise.all([
        this.prisma.novel.findMany({
          where: { isPublic: true, status: { not: 'DRAFT' } },
          include: {
            author: { include: { profile: true } },
            genres: { include: { genre: true } },
            _count: {
              select: { chapters: true, likes: true, bookmarks: true },
            },
          },
          orderBy: [{ likes: { _count: 'desc' } }, { updatedAt: 'desc' }],
          take: 4,
        }),
        this.prisma.world.findMany({
          where: { visibility: 'PUBLIC' },
          include: {
            author: { include: { profile: true } },
            _count: {
              select: { locations: true, characters: true, novelWorlds: true },
            },
          },
          orderBy: [{ novelWorlds: { _count: 'desc' } }, { updatedAt: 'desc' }],
          take: 4,
        }),
        this.prisma.user.findMany({
          where: { isActive: true },
          include: {
            profile: true,
            novels: {
              where: { isPublic: true },
              select: { coverUrl: true },
              take: 3,
              orderBy: { updatedAt: 'desc' },
            },
            _count: { select: { followers: true, novels: true, worlds: true } },
          },
          orderBy: [{ followers: { _count: 'desc' } }, { createdAt: 'desc' }],
          take: 4,
        }),
        this.prisma.post.findMany({
          where: { deletedAt: null },
          include: {
            author: { include: { profile: true } },
            _count: { select: { reactions: true, comments: true } },
          },
          orderBy: [{ reactions: { _count: 'desc' } }, { createdAt: 'desc' }],
          take: 4,
        }),
      ]);

      return {
        novels: novels.map((novel) => this.toNovelSummary(novel)),
        worlds: worlds.map((world) => this.toWorldSummary(world)),
        authors: authors.map((author) => this.toAuthorSummary(author)),
        posts: posts.map((post) => this.toPostSummary(post)),
      };
    });
  }

  async getNewReleases(refresh = false, limit = 10) {
    return this.fromCache(`new-releases:${limit}`, refresh, () =>
      this.computeNewReleases(limit),
    );
  }

  async getGenreDiscovery(slug: string) {
    const genre = await this.prisma.genre.findUnique({
      where: { slug },
    });

    if (!genre) {
      return {
        genre: null,
        items: [],
      };
    }

    const items = await this.prisma.novel.findMany({
      where: {
        isPublic: true,
        status: { not: 'DRAFT' },
        genres: {
          some: {
            genreId: genre.id,
          },
        },
      },
      include: {
        author: { include: { profile: true } },
        genres: { include: { genre: true } },
        _count: { select: { chapters: true, likes: true, bookmarks: true } },
      },
      orderBy: [{ likes: { _count: 'desc' } }, { updatedAt: 'desc' }],
      take: 12,
    });

    return {
      genre: {
        slug: genre.slug,
        label: genre.label,
      },
      items: items.map((novel) => this.toNovelSummary(novel)),
    };
  }

  private async computeTrendingNovels(limit: number) {
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; trending_score: number }>
    >`SELECT id, trending_score::int FROM mv_trending_novels LIMIT ${limit}`;

    const novels = await this.prisma.novel.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      include: {
        author: { include: { profile: true } },
        genres: { include: { genre: true } },
        _count: { select: { chapters: true, likes: true, bookmarks: true } },
      },
    });
    const byId = new Map(novels.map((novel) => [novel.id, novel]));

    return rows
      .map((row) => byId.get(row.id))
      .filter((novel): novel is NonNullable<typeof novel> => Boolean(novel))
      .map((novel) => this.toNovelSummary(novel));
  }

  private async computeTrendingWorlds(limit: number) {
    const worlds = await this.prisma.world.findMany({
      where: {
        visibility: 'PUBLIC',
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        author: { include: { profile: true } },
        _count: {
          select: { locations: true, characters: true, novelWorlds: true },
        },
      },
      orderBy: [
        { characters: { _count: 'desc' } },
        { novelWorlds: { _count: 'desc' } },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    return worlds.map((world) => this.toWorldSummary(world));
  }

  private async computeTrendingAuthors(limit: number) {
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; trending_score: number }>
    >`SELECT id, trending_score::int FROM mv_trending_authors LIMIT ${limit}`;

    const authors = await this.prisma.user.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      include: {
        profile: true,
        novels: {
          where: { isPublic: true, status: { not: 'DRAFT' } },
          select: { coverUrl: true },
          take: 3,
          orderBy: { updatedAt: 'desc' },
        },
        _count: { select: { followers: true, novels: true, worlds: true } },
      },
    });
    const byId = new Map(authors.map((author) => [author.id, author]));

    return rows
      .map((row) => byId.get(row.id))
      .filter((author): author is NonNullable<typeof author> => Boolean(author))
      .map((author) => this.toAuthorSummary(author));
  }

  private async computeTrendingCharacters(limit: number) {
    const trendingNovels = await this.computeTrendingNovels(10);
    if (!trendingNovels.length) {
      return [];
    }

    const novelIds = trendingNovels.map((novel) => String(novel.id));
    const items = await this.prisma.novelCharacter.findMany({
      where: {
        novelId: { in: novelIds },
        character: { isPublic: true },
      },
      include: {
        novel: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        character: {
          include: {
            author: { include: { profile: true } },
            world: {
              select: { id: true, name: true, slug: true, visibility: true },
            },
            _count: {
              select: { relationshipsAsSource: true, novelCharacters: true },
            },
          },
        },
      },
      take: limit * 2,
    });

    const novelOrder = new Map(novelIds.map((id, index) => [id, index]));
    const deduped = new Map<
      string,
      ReturnType<DiscoveryService['toCharacterSummary']>
    >();

    for (const item of items.sort(
      (left, right) =>
        (novelOrder.get(left.novelId) ?? Number.MAX_SAFE_INTEGER) -
        (novelOrder.get(right.novelId) ?? Number.MAX_SAFE_INTEGER),
    )) {
      if (item.character && !deduped.has(item.character.id)) {
        deduped.set(item.character.id, this.toCharacterSummary(item.character));
      }
      if (deduped.size >= limit) {
        break;
      }
    }

    return [...deduped.values()];
  }

  private async computeNewReleases(limit: number) {
    const rows = await this.prisma.chapter.groupBy({
      by: ['novelId'],
      where: {
        status: 'PUBLISHED',
        publishedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
        novel: {
          isPublic: true,
          status: { not: 'DRAFT' },
        },
      },
      _count: {
        _all: true,
      },
      _max: {
        publishedAt: true,
      },
      orderBy: {
        _max: { publishedAt: 'desc' },
      },
      take: limit,
    });

    const novels = await this.prisma.novel.findMany({
      where: { id: { in: rows.map((row) => row.novelId) } },
      include: {
        author: { include: { profile: true } },
        genres: { include: { genre: true } },
        _count: { select: { chapters: true, likes: true, bookmarks: true } },
      },
    });
    const byId = new Map(novels.map((novel) => [novel.id, novel]));
    const latestPublishedChapters = await this.prisma.chapter.findMany({
      where: {
        novelId: { in: rows.map((row) => row.novelId) },
        status: 'PUBLISHED',
        publishedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: [{ novelId: 'asc' }, { publishedAt: 'desc' }],
      select: {
        novelId: true,
        title: true,
        slug: true,
        publishedAt: true,
      },
    });
    const latestChapterByNovelId = new Map<
      string,
      { title: string; slug: string; publishedAt: Date | null }
    >();

    for (const chapter of latestPublishedChapters) {
      if (!latestChapterByNovelId.has(chapter.novelId)) {
        latestChapterByNovelId.set(chapter.novelId, {
          title: chapter.title,
          slug: chapter.slug,
          publishedAt: chapter.publishedAt,
        });
      }
    }

    return rows.map((row) => ({
      novel: this.toNovelSummary(byId.get(row.novelId)!),
      new_chapters_count: row._count._all,
      latest_chapter: latestChapterByNovelId.get(row.novelId) ?? null,
    }));
  }

  private async computeGenresSpotlight(limit: number, topNovels: number) {
    const genres = await this.prisma.genre.findMany({
      include: {
        _count: {
          select: { novels: true },
        },
        novels: {
          take: topNovels,
          where: {
            novel: {
              isPublic: true,
              status: { not: 'DRAFT' },
            },
          },
          orderBy: {
            novel: { updatedAt: 'desc' },
          },
          include: {
            novel: {
              include: {
                author: { include: { profile: true } },
                genres: { include: { genre: true } },
                _count: {
                  select: { chapters: true, likes: true, bookmarks: true },
                },
              },
            },
          },
        },
      },
      orderBy: {
        novels: {
          _count: 'desc',
        },
      },
      take: limit,
    });

    return genres.map((genre) => ({
      genre: {
        slug: genre.slug,
        label: genre.label,
      },
      top_novels: genre.novels.map((item) => this.toNovelSummary(item.novel)),
    }));
  }

  private async computePlatformStats() {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        novels_count: bigint;
        authors_count: bigint;
        worlds_count: bigint;
        characters_count: bigint;
        chapters_count: bigint;
      }>
    >(`SELECT * FROM mv_platform_stats`);

    const row = rows[0];

    return {
      total_novels: Number(row?.novels_count ?? 0),
      total_authors: Number(row?.authors_count ?? 0),
      total_worlds: Number(row?.worlds_count ?? 0),
      total_characters: Number(row?.characters_count ?? 0),
      total_chapters_published: Number(row?.chapters_count ?? 0),
    };
  }

  private async computeCommunityPosts(limit: number) {
    const posts = await this.prisma.post.findMany({
      where: { deletedAt: null },
      include: {
        author: { include: { profile: true } },
        _count: { select: { reactions: true, comments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return posts.map((post) => this.toPostSummary(post));
  }

  private async fromCache<T>(
    key: string,
    refresh: boolean,
    factory: () => Promise<T>,
  ): Promise<T> {
    if (!refresh) {
      const cached = await this.cache.get<T>(key);
      if (cached !== null) return cached;
    }

    const value = await factory();
    await this.cache.set(key, value, APP_CONFIG.cache.discoveryTtl);
    return value;
  }

  private toNovelSummary(
    novel: Prisma.NovelGetPayload<{
      include: {
        author: { include: { profile: true } };
        genres: { include: { genre: true } };
        _count: { select: { chapters: true; likes: true; bookmarks: true } };
      };
    }>,
  ) {
    return {
      id: novel.id,
      title: novel.title,
      slug: novel.slug,
      synopsis: novel.synopsis,
      coverUrl: novel.coverUrl,
      status: novel.status,
      rating: novel.rating,
      tags: novel.tags,
      warnings: novel.warnings,
      isPublic: novel.isPublic,
      wordCount: novel.wordCount,
      viewsCount: novel.viewsCount,
      createdAt: novel.createdAt,
      updatedAt: novel.updatedAt,
      author: {
        id: novel.author.id,
        username: novel.author.username,
        displayName: novel.author.profile?.displayName ?? novel.author.username,
        avatarUrl: novel.author.profile?.avatarUrl ?? null,
      },
      genres: novel.genres.map((item) => ({
        id: item.genre.id,
        slug: item.genre.slug,
        label: item.genre.label,
      })),
      stats: {
        chaptersCount: novel._count.chapters,
        publishedChaptersCount: novel._count.chapters,
        likesCount: novel._count.likes,
        bookmarksCount: novel._count.bookmarks,
      },
      viewerContext: null,
    };
  }

  private toWorldSummary(
    world: Prisma.WorldGetPayload<{
      include: {
        author: { include: { profile: true } };
        _count: {
          select: { locations: true; characters: true; novelWorlds: true };
        };
      };
    }>,
  ) {
    return {
      id: world.id,
      name: world.name,
      slug: world.slug,
      tagline: world.tagline,
      description: world.description,
      coverUrl: world.coverUrl,
      visibility: world.visibility,
      tags: world.tags,
      createdAt: world.createdAt,
      updatedAt: world.updatedAt,
      author: {
        id: world.author.id,
        username: world.author.username,
        displayName: world.author.profile?.displayName ?? world.author.username,
        avatarUrl: world.author.profile?.avatarUrl ?? null,
      },
      stats: {
        locationsCount: world._count.locations,
        charactersCount: world._count.characters,
        novelsCount: world._count.novelWorlds,
      },
    };
  }

  private toCharacterSummary(
    character: Prisma.CharacterGetPayload<{
      include: {
        author: { include: { profile: true } };
        world: {
          select: { id: true; name: true; slug: true; visibility: true };
        };
        _count: {
          select: { relationshipsAsSource: true; novelCharacters: true };
        };
      };
    }>,
  ) {
    return {
      id: character.id,
      name: character.name,
      slug: character.slug,
      alias: character.alias,
      role: character.role,
      status: character.status,
      avatarUrl: character.avatarUrl,
      isPublic: character.isPublic,
      tags: character.tags,
      createdAt: character.createdAt,
      updatedAt: character.updatedAt,
      author: {
        id: character.author.id,
        username: character.author.username,
        displayName:
          character.author.profile?.displayName ?? character.author.username,
        avatarUrl: character.author.profile?.avatarUrl ?? null,
      },
      world:
        character.world?.visibility === 'PUBLIC'
          ? {
              id: character.world.id,
              name: character.world.name,
              slug: character.world.slug,
            }
          : null,
      stats: {
        relationshipsCount: character._count.relationshipsAsSource,
        novelsCount: character._count.novelCharacters,
      },
    };
  }

  private toAuthorSummary(
    user: Prisma.UserGetPayload<{
      include: {
        profile: true;
        novels: { select: { coverUrl: true } };
        _count: { select: { followers: true; novels: true; worlds: true } };
      };
    }>,
  ) {
    return {
      id: user.id,
      username: user.username,
      display_name: user.profile?.displayName ?? user.username,
      avatar_url: user.profile?.avatarUrl ?? null,
      bio: user.profile?.bio ?? null,
      latest_covers: user.novels.map((novel) => novel.coverUrl).filter(Boolean),
      stats: {
        followers_count: user._count.followers,
        novels_count: user._count.novels,
        worlds_count: user._count.worlds,
      },
    };
  }

  private toPostSummary(
    post: Prisma.PostGetPayload<{
      include: {
        author: { include: { profile: true } };
        _count: { select: { reactions: true; comments: true } };
      };
    }>,
  ) {
    return {
      id: post.id,
      content_excerpt: post.content.slice(0, 200),
      type: post.type,
      created_at: post.createdAt,
      author: {
        username: post.author.username,
        display_name: post.author.profile?.displayName ?? post.author.username,
        avatar_url: post.author.profile?.avatarUrl ?? null,
      },
      stats: {
        reactions_count: post._count.reactions,
        comments_count: post._count.comments,
      },
    };
  }
}
