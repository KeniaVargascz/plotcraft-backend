import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SearchCharactersQueryDto,
  SearchNovelsQueryDto,
  SearchPostsQueryDto,
  SearchQueryDto,
  SearchSuggestionsQueryDto,
  SearchUsersQueryDto,
  SearchWorldsQueryDto,
} from './dto/search-query.dto';
import { buildSearchQuery } from './utils/search-query-builder.util';

type SearchSection = {
  items: Record<string, unknown>[];
  total_hint: number;
};

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async searchGlobal(query: SearchQueryDto, userId?: string | null) {
    this.recordHistoryAsync(userId, query.q);

    const [novels, worlds, characters, users, posts, wbEntries] = await Promise.all([
      this.searchNovelsSection({ ...query, limit: 5, sort: 'relevance' }),
      this.searchWorldsSection({ ...query, limit: 5, sort: 'relevance' }),
      this.searchCharactersSection({ ...query, limit: 5 }),
      this.searchUsersSection({ ...query, limit: 5, sort: 'relevance' }),
      this.searchPostsSection({ ...query, limit: 5, sort: 'relevance' }),
      this.searchWbEntriesSection(query.q, 5),
    ]);

    return {
      query: query.q.trim(),
      results: {
        novels,
        worlds,
        characters,
        users,
        posts,
        wb_entries: wbEntries,
      },
    };
  }

  async searchNovels(query: SearchNovelsQueryDto, userId?: string | null) {
    this.recordHistoryAsync(userId, query.q);
    const limit = query.limit ?? 20;
    const offset = this.decodeCursor(query.cursor);
    const section = await this.searchNovelsSection(query, offset);

    return {
      data: section.items,
      pagination: {
        nextCursor:
          section.items.length === limit && offset + limit < section.total_hint
            ? this.encodeCursor(offset + limit)
            : null,
        hasMore: offset + limit < section.total_hint,
        limit,
      },
    };
  }

  async searchWorlds(query: SearchWorldsQueryDto, userId?: string | null) {
    this.recordHistoryAsync(userId, query.q);
    const limit = query.limit ?? 20;
    const offset = this.decodeCursor(query.cursor);
    const section = await this.searchWorldsSection(query, offset);

    return {
      data: section.items,
      pagination: {
        nextCursor:
          section.items.length === limit && offset + limit < section.total_hint
            ? this.encodeCursor(offset + limit)
            : null,
        hasMore: offset + limit < section.total_hint,
        limit,
      },
    };
  }

  async searchCharacters(
    query: SearchCharactersQueryDto,
    userId?: string | null,
  ) {
    this.recordHistoryAsync(userId, query.q);
    const limit = query.limit ?? 20;
    const offset = this.decodeCursor(query.cursor);
    const section = await this.searchCharactersSection(query, offset);

    return {
      data: section.items,
      pagination: {
        nextCursor:
          section.items.length === limit && offset + limit < section.total_hint
            ? this.encodeCursor(offset + limit)
            : null,
        hasMore: offset + limit < section.total_hint,
        limit,
      },
    };
  }

  async searchUsers(query: SearchUsersQueryDto, userId?: string | null) {
    this.recordHistoryAsync(userId, query.q);
    const limit = query.limit ?? 20;
    const offset = this.decodeCursor(query.cursor);
    const section = await this.searchUsersSection(query, offset);

    return {
      data: section.items,
      pagination: {
        nextCursor:
          section.items.length === limit && offset + limit < section.total_hint
            ? this.encodeCursor(offset + limit)
            : null,
        hasMore: offset + limit < section.total_hint,
        limit,
      },
    };
  }

  async searchPosts(query: SearchPostsQueryDto, userId?: string | null) {
    this.recordHistoryAsync(userId, query.q);
    const limit = query.limit ?? 20;
    const offset = this.decodeCursor(query.cursor);
    const section = await this.searchPostsSection(query, offset);

    return {
      data: section.items,
      pagination: {
        nextCursor:
          section.items.length === limit && offset + limit < section.total_hint
            ? this.encodeCursor(offset + limit)
            : null,
        hasMore: offset + limit < section.total_hint,
        limit,
      },
    };
  }

  async getSuggestions(query: SearchSuggestionsQueryDto) {
    const normalized = query.q.trim();
    const prefix = normalized.toLowerCase();

    const [novels, users, worlds, characters] = await Promise.all([
      this.prisma.novel.findMany({
        where: {
          isPublic: true,
          title: { contains: normalized, mode: 'insensitive' },
        },
        include: {
          author: { include: { profile: true } },
        },
        take: 6,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.user.findMany({
        where: {
          isActive: true,
          NOT: { privacySettings: { searchable: false } },
          OR: [
            { username: { contains: normalized, mode: 'insensitive' } },
            {
              profile: {
                displayName: { contains: normalized, mode: 'insensitive' },
              },
            },
          ],
        },
        include: { profile: true },
        take: 6,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.world.findMany({
        where: {
          visibility: 'PUBLIC',
          name: { contains: normalized, mode: 'insensitive' },
        },
        include: {
          author: { include: { profile: true } },
        },
        take: 6,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.character.findMany({
        where: {
          isPublic: true,
          name: { contains: normalized, mode: 'insensitive' },
        },
        include: {
          author: { include: { profile: true } },
          world: true,
        },
        take: 6,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const rankByPrefix = <T extends { label: string }>(items: T[]) =>
      [...items].sort((left, right) => {
        const leftStarts = left.label.toLowerCase().startsWith(prefix);
        const rightStarts = right.label.toLowerCase().startsWith(prefix);
        if (leftStarts === rightStarts) {
          return left.label.localeCompare(right.label);
        }
        return leftStarts ? -1 : 1;
      });

    const suggestions = [
      ...rankByPrefix(
        novels.map((novel) => ({
          type: 'novel' as const,
          label: novel.title,
          sublabel: `por ${novel.author.profile?.displayName ?? novel.author.username}`,
          url: `/novelas/${novel.slug}`,
          avatar_url: novel.author.profile?.avatarUrl ?? null,
        })),
      ).slice(0, 2),
      ...rankByPrefix(
        users.map((user) => ({
          type: 'user' as const,
          label: user.username,
          sublabel: user.profile?.displayName ?? `@${user.username}`,
          url: `/perfil/${user.username}`,
          avatar_url: user.profile?.avatarUrl ?? null,
        })),
      ).slice(0, 2),
      ...rankByPrefix(
        worlds.map((world) => ({
          type: 'world' as const,
          label: world.name,
          sublabel:
            world.tagline ??
            `por ${world.author.profile?.displayName ?? world.author.username}`,
          url: `/mundos/${world.slug}`,
          avatar_url: world.author.profile?.avatarUrl ?? null,
        })),
      ).slice(0, 2),
      ...rankByPrefix(
        characters.map((character) => ({
          type: 'character' as const,
          label: character.name,
          sublabel: character.world?.name ?? `@${character.author.username}`,
          url: `/personajes/${character.author.username}/${character.slug}`,
          avatar_url:
            character.avatarUrl ?? character.author.profile?.avatarUrl ?? null,
        })),
      ).slice(0, 2),
    ].slice(0, 8);

    return { suggestions };
  }

  async getHistory(userId: string) {
    const history = await this.prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return { history };
  }

  async clearHistory(userId: string) {
    await this.prisma.searchHistory.deleteMany({
      where: { userId },
    });

    return { cleared: true };
  }

  async deleteHistoryEntry(userId: string, historyId: string) {
    await this.prisma.searchHistory.deleteMany({
      where: {
        id: historyId,
        userId,
      },
    });

    return { deleted: true };
  }

  private async searchNovelsSection(
    query: SearchNovelsQueryDto,
    offset = 0,
  ): Promise<SearchSection> {
    const limit = query.limit ?? 20;
    const search = buildSearchQuery(query.q);

    if (query.sort !== 'relevance' || !search.useFullText) {
      const where: Prisma.NovelWhereInput = {
        isPublic: true,
        ...(query.genre
          ? {
              genres: {
                some: {
                  genre: { slug: query.genre },
                },
              },
            }
          : {}),
        ...(query.rating ? { rating: query.rating } : {}),
        ...(query.status ? { status: query.status } : {}),
        OR: [
          { title: { contains: search.normalized, mode: 'insensitive' } },
          { synopsis: { contains: search.normalized, mode: 'insensitive' } },
          { tags: { hasSome: search.terms } },
        ],
      };

      const [items, total] = await Promise.all([
        this.prisma.novel.findMany({
          where,
          include: {
            author: { include: { profile: true } },
            genres: { include: { genre: true } },
            _count: {
              select: { chapters: true, likes: true, bookmarks: true },
            },
          },
          orderBy:
            query.sort === 'popular'
              ? [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }]
              : query.sort === 'views'
                ? [{ viewsCount: 'desc' }, { createdAt: 'desc' }]
                : [{ createdAt: 'desc' }],
          skip: offset,
          take: limit,
        }),
        this.prisma.novel.count({ where }),
      ]);

      return {
        items: items.map((novel) => this.toNovelSummary(novel)),
        total_hint: Math.min(total, 999),
      };
    }

    const params: unknown[] = [search.tsquery, search.ilike];
    const conditions = [
      'n.is_public = true',
      "(n.search_vector @@ to_tsquery('spanish', $1) OR n.title ILIKE $2 OR COALESCE(n.synopsis, '') ILIKE $2)",
    ];

    if (query.genre) {
      params.push(query.genre);
      conditions.push(
        `EXISTS (
          SELECT 1
          FROM novel_genres ng
          JOIN genres g ON g.id = ng.genre_id
          WHERE ng.novel_id = n.id AND g.slug = $${params.length}
        )`,
      );
    }

    if (query.rating) {
      params.push(query.rating);
      conditions.push(`n.rating = $${params.length}::"NovelRating"`);
    }

    if (query.status) {
      params.push(query.status);
      conditions.push(`n.status = $${params.length}::"NovelStatus"`);
    }

    params.push(offset, limit);

    const sql = `
      SELECT n.id,
             CASE
               WHEN n.search_vector @@ to_tsquery('spanish', $1)
                 THEN ts_rank(n.search_vector, to_tsquery('spanish', $1))
               ELSE 0.05
             END AS score
      FROM novels n
      WHERE ${conditions.join(' AND ')}
      ORDER BY score DESC, n.created_at DESC
      OFFSET $${params.length - 1}
      LIMIT $${params.length}
    `;
    const countSql = `
      SELECT LEAST(COUNT(*), 999)::int AS total
      FROM novels n
      WHERE ${conditions.join(' AND ')}
    `;

    const [rows, totalRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ id: string; score: number }>>(
        sql,
        ...params,
      ),
      this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
        countSql,
        ...params.slice(0, params.length - 2),
      ),
    ]);
    const novels = await this.prisma.novel.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      include: {
        author: { include: { profile: true } },
        genres: { include: { genre: true } },
        _count: { select: { chapters: true, likes: true, bookmarks: true } },
      },
    });
    const byId = new Map(novels.map((novel) => [novel.id, novel]));

    return {
      items: rows
        .map((row) => byId.get(row.id))
        .filter((novel): novel is NonNullable<typeof novel> => Boolean(novel))
        .map((novel) => this.toNovelSummary(novel)),
      total_hint: totalRows[0]?.total ?? 0,
    };
  }

  private async searchWorldsSection(
    query: SearchWorldsQueryDto,
    offset = 0,
  ): Promise<SearchSection> {
    const limit = query.limit ?? 20;
    const search = buildSearchQuery(query.q);

    if (query.sort !== 'relevance' || !search.useFullText) {
      const where: Prisma.WorldWhereInput = {
        visibility: 'PUBLIC',
        OR: [
          { name: { contains: search.normalized, mode: 'insensitive' } },
          { tagline: { contains: search.normalized, mode: 'insensitive' } },
          { description: { contains: search.normalized, mode: 'insensitive' } },
          { tags: { hasSome: search.terms } },
        ],
      };

      const [items, total] = await Promise.all([
        this.prisma.world.findMany({
          where,
          include: {
            author: { include: { profile: true } },
            _count: {
              select: { locations: true, characters: true, novelWorlds: true },
            },
          },
          orderBy:
            query.sort === 'popular'
              ? [{ novelWorlds: { _count: 'desc' } }, { createdAt: 'desc' }]
              : [{ createdAt: 'desc' }],
          skip: offset,
          take: limit,
        }),
        this.prisma.world.count({ where }),
      ]);

      return {
        items: items.map((world) => this.toWorldSummary(world)),
        total_hint: Math.min(total, 999),
      };
    }

    const sql = `
      SELECT w.id,
             CASE
               WHEN w.search_vector @@ to_tsquery('spanish', $1)
                 THEN ts_rank(w.search_vector, to_tsquery('spanish', $1))
               ELSE 0.05
             END AS score
      FROM worlds w
      WHERE w.visibility = 'PUBLIC'
        AND (
          w.search_vector @@ to_tsquery('spanish', $1)
          OR w.name ILIKE $2
          OR COALESCE(w.tagline, '') ILIKE $2
          OR COALESCE(w.description, '') ILIKE $2
        )
      ORDER BY score DESC, w.created_at DESC
      OFFSET $3
      LIMIT $4
    `;
    const countSql = `
      SELECT LEAST(COUNT(*), 999)::int AS total
      FROM worlds w
      WHERE w.visibility = 'PUBLIC'
        AND (
          w.search_vector @@ to_tsquery('spanish', $1)
          OR w.name ILIKE $2
          OR COALESCE(w.tagline, '') ILIKE $2
          OR COALESCE(w.description, '') ILIKE $2
        )
    `;
    const [rows, totalRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
        sql,
        search.tsquery,
        search.ilike,
        offset,
        limit,
      ),
      this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
        countSql,
        search.tsquery,
        search.ilike,
      ),
    ]);
    const worlds = await this.prisma.world.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      include: {
        author: { include: { profile: true } },
        _count: {
          select: { locations: true, characters: true, novelWorlds: true },
        },
      },
    });
    const byId = new Map(worlds.map((world) => [world.id, world]));

    return {
      items: rows
        .map((row) => byId.get(row.id))
        .filter((world): world is NonNullable<typeof world> => Boolean(world))
        .map((world) => this.toWorldSummary(world)),
      total_hint: totalRows[0]?.total ?? 0,
    };
  }

  private async searchCharactersSection(
    query: SearchCharactersQueryDto,
    offset = 0,
  ): Promise<SearchSection> {
    const limit = query.limit ?? 20;
    const search = buildSearchQuery(query.q);
    const where: Prisma.CharacterWhereInput = {
      isPublic: true,
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.world_id ? { worldId: query.world_id } : {}),
      OR: search.useFullText
        ? [
            { name: { contains: search.normalized, mode: 'insensitive' } },
            { alias: { hasSome: search.terms } },
            { tags: { hasSome: search.terms } },
          ]
        : [
            { name: { contains: search.normalized, mode: 'insensitive' } },
            { alias: { hasSome: search.terms } },
            {
              personality: { contains: search.normalized, mode: 'insensitive' },
            },
          ],
    };

    const [items, total] = await Promise.all([
      this.prisma.character.findMany({
        where,
        include: {
          author: { include: { profile: true } },
          world: {
            select: { id: true, name: true, slug: true, visibility: true },
          },
          _count: {
            select: { relationshipsAsSource: true, novelCharacters: true },
          },
        },
        orderBy: [{ updatedAt: 'desc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.character.count({ where }),
    ]);

    return {
      items: items.map((character) => this.toCharacterSummary(character)),
      total_hint: Math.min(total, 999),
    };
  }

  private async searchUsersSection(
    query: SearchUsersQueryDto,
    offset = 0,
  ): Promise<SearchSection> {
    const limit = query.limit ?? 20;
    const search = buildSearchQuery(query.q);
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        NOT: { privacySettings: { searchable: false } },
        OR: [
          { username: { contains: search.normalized, mode: 'insensitive' } },
          { email: { contains: search.normalized, mode: 'insensitive' } },
          {
            profile: {
              displayName: { contains: search.normalized, mode: 'insensitive' },
            },
          },
          {
            profile: {
              bio: { contains: search.normalized, mode: 'insensitive' },
            },
          },
        ],
      },
      include: {
        profile: true,
        _count: {
          select: {
            followers: true,
            novels: true,
            worlds: true,
          },
        },
      },
    });

    const ranked = users
      .map((user) => ({
        user,
        score: this.rankUser(
          user.username,
          user.profile?.displayName ?? '',
          search.normalized,
        ),
      }))
      .sort((left, right) => {
        if (query.sort === 'followers') {
          return right.user._count.followers - left.user._count.followers;
        }
        if (query.sort === 'recent') {
          return right.user.createdAt.getTime() - left.user.createdAt.getTime();
        }
        if (right.score === left.score) {
          return right.user.createdAt.getTime() - left.user.createdAt.getTime();
        }
        return right.score - left.score;
      });

    return {
      items: ranked
        .slice(offset, offset + limit)
        .map((entry) => this.toUserSearchResult(entry.user)),
      total_hint: Math.min(ranked.length, 999),
    };
  }

  private async searchPostsSection(
    query: SearchPostsQueryDto,
    offset = 0,
  ): Promise<SearchSection> {
    const limit = query.limit ?? 20;
    const search = buildSearchQuery(query.q);

    if (query.sort !== 'relevance' || !search.useFullText) {
      const where: Prisma.PostWhereInput = {
        deletedAt: null,
        ...(query.type ? { type: query.type } : {}),
        content: { contains: search.normalized, mode: 'insensitive' },
      };

      const [items, total] = await Promise.all([
        this.prisma.post.findMany({
          where,
          include: {
            author: { include: { profile: true } },
            _count: { select: { reactions: true, comments: true } },
          },
          orderBy:
            query.sort === 'reactions'
              ? [{ reactions: { _count: 'desc' } }, { createdAt: 'desc' }]
              : [{ createdAt: 'desc' }],
          skip: offset,
          take: limit,
        }),
        this.prisma.post.count({ where }),
      ]);

      return {
        items: items.map((post) => this.toPostSearchResult(post)),
        total_hint: Math.min(total, 999),
      };
    }

    const params: unknown[] = [search.tsquery, search.ilike];
    const conditions = [
      'p.deleted_at IS NULL',
      "(p.search_vector @@ to_tsquery('spanish', $1) OR p.content ILIKE $2)",
    ];

    if (query.type) {
      params.push(query.type);
      conditions.push(`p.type = $${params.length}::"PostType"`);
    }

    params.push(offset, limit);
    const sql = `
      SELECT p.id,
             CASE
               WHEN p.search_vector @@ to_tsquery('spanish', $1)
                 THEN ts_rank(p.search_vector, to_tsquery('spanish', $1))
               ELSE 0.05
             END AS score,
             (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id) AS reactions_count
      FROM posts p
      WHERE ${conditions.join(' AND ')}
      ORDER BY score DESC, p.created_at DESC
      OFFSET $${params.length - 1}
      LIMIT $${params.length}
    `;
    const countSql = `
      SELECT LEAST(COUNT(*), 999)::int AS total
      FROM posts p
      WHERE ${conditions.join(' AND ')}
    `;
    const [rows, totalRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ id: string }>>(sql, ...params),
      this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
        countSql,
        ...params.slice(0, params.length - 2),
      ),
    ]);
    const posts = await this.prisma.post.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      include: {
        author: { include: { profile: true } },
        _count: { select: { reactions: true, comments: true } },
      },
    });
    const byId = new Map(posts.map((post) => [post.id, post]));

    return {
      items: rows
        .map((row) => byId.get(row.id))
        .filter((post): post is NonNullable<typeof post> => Boolean(post))
        .map((post) => this.toPostSearchResult(post)),
      total_hint: totalRows[0]?.total ?? 0,
    };
  }

  private async searchWbEntriesSection(
    q: string,
    limit = 5,
  ): Promise<SearchSection> {
    const search = buildSearchQuery(q);

    if (!search.useFullText) {
      const where: Prisma.WbEntryWhereInput = {
        isPublic: true,
        world: { visibility: 'PUBLIC' },
        OR: [
          { name: { contains: search.normalized, mode: 'insensitive' } },
          { summary: { contains: search.normalized, mode: 'insensitive' } },
          { tags: { hasSome: search.terms } },
        ],
      };

      const [items, total] = await Promise.all([
        this.prisma.wbEntry.findMany({
          where,
          include: {
            category: { select: { id: true, name: true, slug: true, icon: true, color: true } },
            author: { include: { profile: true } },
            world: { select: { id: true, name: true, slug: true } },
          },
          orderBy: [{ updatedAt: 'desc' }],
          take: limit,
        }),
        this.prisma.wbEntry.count({ where }),
      ]);

      return {
        items: items.map((entry) => this.toWbEntrySummary(entry)),
        total_hint: Math.min(total, 999),
      };
    }

    const sql = `
      SELECT e.id,
             CASE
               WHEN e.search_vector @@ to_tsquery('spanish', $1)
                 THEN ts_rank(e.search_vector, to_tsquery('spanish', $1))
               ELSE 0.05
             END AS score
      FROM wb_entries e
      JOIN worlds w ON w.id = e.world_id
      WHERE e.is_public = true
        AND w.visibility = 'PUBLIC'
        AND (
          e.search_vector @@ to_tsquery('spanish', $1)
          OR e.name ILIKE $2
          OR COALESCE(e.summary, '') ILIKE $2
        )
      ORDER BY score DESC, e.created_at DESC
      LIMIT $3
    `;
    const countSql = `
      SELECT LEAST(COUNT(*), 999)::int AS total
      FROM wb_entries e
      JOIN worlds w ON w.id = e.world_id
      WHERE e.is_public = true
        AND w.visibility = 'PUBLIC'
        AND (
          e.search_vector @@ to_tsquery('spanish', $1)
          OR e.name ILIKE $2
          OR COALESCE(e.summary, '') ILIKE $2
        )
    `;

    const [rows, totalRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
        sql,
        search.tsquery,
        search.ilike,
        limit,
      ),
      this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
        countSql,
        search.tsquery,
        search.ilike,
      ),
    ]);

    if (rows.length === 0) {
      return { items: [], total_hint: 0 };
    }

    const entries = await this.prisma.wbEntry.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      include: {
        category: { select: { id: true, name: true, slug: true, icon: true, color: true } },
        author: { include: { profile: true } },
        world: { select: { id: true, name: true, slug: true } },
      },
    });
    const byId = new Map(entries.map((e) => [e.id, e]));

    return {
      items: rows
        .map((r) => byId.get(r.id))
        .filter((e): e is NonNullable<typeof e> => Boolean(e))
        .map((entry) => this.toWbEntrySummary(entry)),
      total_hint: totalRows[0]?.total ?? 0,
    };
  }

  private toWbEntrySummary(
    entry: Prisma.WbEntryGetPayload<{
      include: {
        category: { select: { id: true; name: true; slug: true; icon: true; color: true } };
        author: { include: { profile: true } };
        world: { select: { id: true; name: true; slug: true } };
      };
    }>,
  ) {
    return {
      type: 'wb_entry' as const,
      id: entry.id,
      name: entry.name,
      slug: entry.slug,
      summary: entry.summary,
      tags: entry.tags,
      isPublic: entry.isPublic,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      category: entry.category,
      world: entry.world,
      author: {
        id: entry.author.id,
        username: entry.author.username,
        displayName: entry.author.profile?.displayName ?? entry.author.username,
        avatarUrl: entry.author.profile?.avatarUrl ?? null,
      },
    };
  }

  private recordHistoryAsync(userId: string | null | undefined, query: string) {
    if (!userId || query.trim().length < 2) {
      return;
    }

    void Promise.resolve()
      .then(async () => {
        await this.prisma.searchHistory.upsert({
          where: {
            userId_query: {
              userId,
              query: query.trim(),
            },
          },
          update: {
            createdAt: new Date(),
          },
          create: {
            userId,
            query: query.trim(),
          },
        });

        const overflow = await this.prisma.searchHistory.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip: 20,
          select: { id: true },
        });

        if (overflow.length) {
          await this.prisma.searchHistory.deleteMany({
            where: {
              id: {
                in: overflow.map((entry) => entry.id),
              },
            },
          });
        }
      })
      .catch(() => undefined);
  }

  private encodeCursor(offset: number) {
    return Buffer.from(String(offset)).toString('base64url');
  }

  private decodeCursor(cursor?: string) {
    if (!cursor) {
      return 0;
    }

    const parsed = Number(Buffer.from(cursor, 'base64url').toString('utf8'));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  private rankUser(username: string, displayName: string, query: string) {
    const normalized = query.toLowerCase();
    const usernameValue = username.toLowerCase();
    const displayNameValue = displayName.toLowerCase();

    let score = 1;
    if (usernameValue.startsWith(normalized)) {
      score += 4;
    }
    if (displayNameValue.startsWith(normalized)) {
      score += 3;
    }
    if (usernameValue.includes(normalized)) {
      score += 2;
    }
    if (displayNameValue.includes(normalized)) {
      score += 1;
    }

    return score;
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
        likesCount: novel._count.likes,
        bookmarksCount: novel._count.bookmarks,
      },
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

  private toUserSearchResult(
    user: Prisma.UserGetPayload<{
      include: {
        profile: true;
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
      stats: {
        followers_count: user._count.followers,
        novels_count: user._count.novels,
        worlds_count: user._count.worlds,
      },
    };
  }

  private toPostSearchResult(
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
