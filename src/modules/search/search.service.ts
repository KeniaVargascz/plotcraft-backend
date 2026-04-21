import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SearchCharactersQueryDto,
  SearchNovelsQueryDto,
  SearchPostsQueryDto,
  SearchQueryDto,
  SearchSuggestionsQueryDto,
  SearchUnifiedQueryDto,
  SearchUsersQueryDto,
  SearchWorldsQueryDto,
} from './dto/search-query.dto';
import { SearchNovelsService } from './services/search-novels.service';
import { SearchWorldsService } from './services/search-worlds.service';
import { SearchContentService } from './services/search-content.service';
import { SearchHistoryService } from './services/search-history.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly novelsSearch: SearchNovelsService,
    private readonly worldsSearch: SearchWorldsService,
    private readonly contentSearch: SearchContentService,
    private readonly historySearch: SearchHistoryService,
  ) {}

  async searchUnified(query: SearchUnifiedQueryDto, userId?: string | null) {
    this.historySearch.recordHistoryAsync(userId, query.q);

    const allTypes = [
      'novels',
      'worlds',
      'characters',
      'users',
      'posts',
      'threads',
      'communities',
    ] as const;
    type AllowedType = (typeof allTypes)[number];

    const rawTypes = Array.isArray(query.types)
      ? query.types
      : query.types
        ? [query.types]
        : [];
    const requested = rawTypes.length
      ? rawTypes.filter((t): t is AllowedType =>
          (allTypes as readonly string[]).includes(t),
        )
      : (allTypes as readonly AllowedType[] as AllowedType[]);

    const limit = query.limit ?? 20;
    const term = query.q.trim();
    const containsInsensitive = {
      contains: term,
      mode: 'insensitive' as const,
    };

    const results: Array<Record<string, unknown>> = [];

    if (requested.includes('novels')) {
      const novels = await this.prisma.novel.findMany({
        where: {
          isPublic: true,
          OR: [
            { title: containsInsensitive },
            { synopsis: containsInsensitive },
          ],
        },
        include: {
          author: { include: { profile: true } },
          _count: { select: { chapters: true } },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
      for (const n of novels) {
        results.push({
          id: n.id,
          type: 'novel',
          section: 'novelas',
          title: n.title,
          excerpt: (n.synopsis ?? '').slice(0, 150),
          author: {
            username: n.author.username,
            displayName: n.author.profile?.displayName ?? n.author.username,
            avatarUrl: n.author.profile?.avatarUrl ?? null,
          },
          url: `/novelas/${n.slug}`,
          metadata: {
            coverUrl: n.coverUrl,
            status: n.status,
            chaptersCount: n._count.chapters,
          },
          createdAt: n.createdAt,
        });
      }
    }

    if (requested.includes('worlds')) {
      const worlds = await this.prisma.world.findMany({
        where: {
          visibility: 'PUBLIC',
          OR: [
            { name: containsInsensitive },
            { description: containsInsensitive },
          ],
        },
        include: { author: { include: { profile: true } } },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
      for (const w of worlds) {
        results.push({
          id: w.id,
          type: 'world',
          section: 'mundos',
          title: w.name,
          excerpt: (w.tagline ?? w.description ?? '').slice(0, 150),
          author: {
            username: w.author.username,
            displayName: w.author.profile?.displayName ?? w.author.username,
            avatarUrl: w.author.profile?.avatarUrl ?? null,
          },
          url: `/mundos/${w.slug}`,
          metadata: { coverUrl: w.coverUrl },
          createdAt: w.createdAt,
        });
      }
    }

    if (requested.includes('characters')) {
      const characters = await this.prisma.character.findMany({
        where: {
          isPublic: true,
          name: containsInsensitive,
        },
        include: { author: { include: { profile: true } } },
        take: limit,
      });
      for (const c of characters) {
        results.push({
          id: c.id,
          type: 'character',
          section: 'personajes',
          title: c.name,
          excerpt: (c.personality ?? '').slice(0, 150),
          author: {
            username: c.author.username,
            displayName: c.author.profile?.displayName ?? c.author.username,
            avatarUrl: c.author.profile?.avatarUrl ?? null,
          },
          url: `/personajes/${c.author.username}/${c.slug}`,
          metadata: { avatarUrl: c.avatarUrl },
          createdAt: c.createdAt,
        });
      }
    }

    if (requested.includes('users')) {
      const users = await this.prisma.user.findMany({
        where: {
          isActive: true,
          NOT: { privacySettings: { searchable: false } },
          OR: [
            { username: containsInsensitive },
            {
              profile: { displayName: containsInsensitive },
            },
          ],
        },
        include: { profile: true },
        take: limit,
      });
      for (const u of users) {
        results.push({
          id: u.id,
          type: 'user',
          section: 'usuarios',
          title: u.profile?.displayName ?? u.username,
          excerpt: (u.profile?.bio ?? '').slice(0, 150),
          author: null,
          url: `/perfiles/${u.username}`,
          metadata: {
            username: u.username,
            avatarUrl: u.profile?.avatarUrl ?? null,
          },
          createdAt: u.createdAt,
        });
      }
    }

    if (requested.includes('posts')) {
      const posts = await this.prisma.post.findMany({
        where: {
          deletedAt: null,
          content: containsInsensitive,
        },
        include: { author: { include: { profile: true } } },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
      for (const p of posts) {
        results.push({
          id: p.id,
          type: 'post',
          section: 'feed',
          title: p.content.slice(0, 80),
          excerpt: p.content.slice(0, 150),
          author: {
            username: p.author.username,
            displayName: p.author.profile?.displayName ?? p.author.username,
            avatarUrl: p.author.profile?.avatarUrl ?? null,
          },
          url: `/explorar`,
          metadata: {
            imageCount: p.imageUrls?.length ?? 0,
            tags: p.tags ?? [],
          },
          createdAt: p.createdAt,
        });
      }
    }

    if (requested.includes('threads')) {
      const threads = await this.prisma.forumThread.findMany({
        where: {
          deletedAt: null,
          forumId: { not: null },
          OR: [
            { title: containsInsensitive },
            { content: containsInsensitive },
          ],
        },
        include: {
          author: { include: { profile: true } },
          forum: {
            include: {
              community: { select: { slug: true, name: true } },
            },
          },
          _count: { select: { replies: true } },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
      for (const t of threads) {
        if (!t.forum) continue;
        results.push({
          id: t.id,
          type: 'thread',
          section: 'foro',
          title: t.title,
          excerpt: t.content.slice(0, 150),
          author: {
            username: t.author.username,
            displayName: t.author.profile?.displayName ?? t.author.username,
            avatarUrl: t.author.profile?.avatarUrl ?? null,
          },
          url: `/comunidades/${t.forum.community.slug}/foros/${t.forum.slug}/hilos/${t.slug}`,
          metadata: {
            forumName: t.forum.name,
            forumSlug: t.forum.slug,
            communitySlug: t.forum.community.slug,
            replyCount: t._count.replies,
          },
          createdAt: t.createdAt,
        });
      }
    }

    if (requested.includes('communities')) {
      const communities = await this.prisma.community.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { name: containsInsensitive },
            { description: containsInsensitive },
          ],
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
      for (const c of communities) {
        results.push({
          id: c.id,
          type: 'community',
          section: 'comunidad',
          title: c.name,
          excerpt: (c.description ?? '').slice(0, 150),
          author: null,
          url: `/comunidades/${c.slug}`,
          metadata: {
            type: c.type,
            membersCount: c.membersCount,
            coverUrl: c.coverUrl,
          },
          createdAt: c.createdAt,
        });
      }
    }

    return {
      query: term,
      results,
    };
  }

  async searchGlobal(query: SearchQueryDto, userId?: string | null) {
    this.historySearch.recordHistoryAsync(userId, query.q);

    const [novels, worlds, characters, users, posts, wbEntries] =
      await Promise.all([
        this.novelsSearch.searchNovelsSection({ ...query, limit: 5, sort: 'relevance' }),
        this.worldsSearch.searchWorldsSection({ ...query, limit: 5, sort: 'relevance' }),
        this.contentSearch.searchCharactersSection({ ...query, limit: 5 }),
        this.contentSearch.searchUsersSection({ ...query, limit: 5, sort: 'relevance' }),
        this.contentSearch.searchPostsSection({ ...query, limit: 5, sort: 'relevance' }),
        this.worldsSearch.searchWbEntriesSection(query.q, 5),
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
    this.historySearch.recordHistoryAsync(userId, query.q);
    const limit = query.limit ?? 20;

    if (query.page) {
      const offset = (query.page - 1) * limit;
      const section = await this.novelsSearch.searchNovelsSection(query, offset);
      const totalPages = Math.ceil(section.total_hint / limit);

      return {
        data: section.items,
        pagination: {
          page: query.page,
          limit,
          total: section.total_hint,
          totalPages,
          hasMore: query.page < totalPages,
          nextCursor: null,
        },
      };
    }

    const offset = this.decodeCursor(query.cursor);
    const section = await this.novelsSearch.searchNovelsSection(query, offset);

    return {
      data: section.items,
      pagination: {
        nextCursor:
          section.items.length === limit && offset + limit < section.total_hint
            ? this.encodeCursor(offset + limit)
            : null,
        hasMore: offset + limit < section.total_hint,
        limit,
        page: null,
        total: null,
        totalPages: null,
      },
    };
  }

  async searchWorlds(query: SearchWorldsQueryDto, userId?: string | null) {
    this.historySearch.recordHistoryAsync(userId, query.q);
    const limit = query.limit ?? 20;

    if (query.page) {
      const offset = (query.page - 1) * limit;
      const section = await this.worldsSearch.searchWorldsSection(query, offset);
      const totalPages = Math.ceil(section.total_hint / limit);

      return {
        data: section.items,
        pagination: {
          page: query.page,
          limit,
          total: section.total_hint,
          totalPages,
          hasMore: query.page < totalPages,
          nextCursor: null,
        },
      };
    }

    const offset = this.decodeCursor(query.cursor);
    const section = await this.worldsSearch.searchWorldsSection(query, offset);

    return {
      data: section.items,
      pagination: {
        nextCursor:
          section.items.length === limit && offset + limit < section.total_hint
            ? this.encodeCursor(offset + limit)
            : null,
        hasMore: offset + limit < section.total_hint,
        limit,
        page: null,
        total: null,
        totalPages: null,
      },
    };
  }

  async searchCharacters(
    query: SearchCharactersQueryDto,
    userId?: string | null,
  ) {
    this.historySearch.recordHistoryAsync(userId, query.q);
    const limit = query.limit ?? 20;

    if (query.page) {
      const offset = (query.page - 1) * limit;
      const section = await this.contentSearch.searchCharactersSection(query, offset);
      const totalPages = Math.ceil(section.total_hint / limit);

      return {
        data: section.items,
        pagination: {
          page: query.page,
          limit,
          total: section.total_hint,
          totalPages,
          hasMore: query.page < totalPages,
          nextCursor: null,
        },
      };
    }

    const offset = this.decodeCursor(query.cursor);
    const section = await this.contentSearch.searchCharactersSection(query, offset);

    return {
      data: section.items,
      pagination: {
        nextCursor:
          section.items.length === limit && offset + limit < section.total_hint
            ? this.encodeCursor(offset + limit)
            : null,
        hasMore: offset + limit < section.total_hint,
        limit,
        page: null,
        total: null,
        totalPages: null,
      },
    };
  }

  async searchUsers(query: SearchUsersQueryDto, userId?: string | null) {
    this.historySearch.recordHistoryAsync(userId, query.q);
    const limit = query.limit ?? 20;

    if (query.page) {
      const offset = (query.page - 1) * limit;
      const section = await this.contentSearch.searchUsersSection(query, offset);
      const totalPages = Math.ceil(section.total_hint / limit);

      return {
        data: section.items,
        pagination: {
          page: query.page,
          limit,
          total: section.total_hint,
          totalPages,
          hasMore: query.page < totalPages,
          nextCursor: null,
        },
      };
    }

    const offset = this.decodeCursor(query.cursor);
    const section = await this.contentSearch.searchUsersSection(query, offset);

    return {
      data: section.items,
      pagination: {
        nextCursor:
          section.items.length === limit && offset + limit < section.total_hint
            ? this.encodeCursor(offset + limit)
            : null,
        hasMore: offset + limit < section.total_hint,
        limit,
        page: null,
        total: null,
        totalPages: null,
      },
    };
  }

  async searchPosts(query: SearchPostsQueryDto, userId?: string | null) {
    this.historySearch.recordHistoryAsync(userId, query.q);
    const limit = query.limit ?? 20;

    if (query.page) {
      const offset = (query.page - 1) * limit;
      const section = await this.contentSearch.searchPostsSection(query, offset);
      const totalPages = Math.ceil(section.total_hint / limit);

      return {
        data: section.items,
        pagination: {
          page: query.page,
          limit,
          total: section.total_hint,
          totalPages,
          hasMore: query.page < totalPages,
          nextCursor: null,
        },
      };
    }

    const offset = this.decodeCursor(query.cursor);
    const section = await this.contentSearch.searchPostsSection(query, offset);

    return {
      data: section.items,
      pagination: {
        nextCursor:
          section.items.length === limit && offset + limit < section.total_hint
            ? this.encodeCursor(offset + limit)
            : null,
        hasMore: offset + limit < section.total_hint,
        limit,
        page: null,
        total: null,
        totalPages: null,
      },
    };
  }

  async getSuggestions(query: SearchSuggestionsQueryDto) {
    const normalized = query.q.trim();
    const prefix = normalized.toLowerCase();
    const perCategoryLimit = 10;

    const [novels, users, worlds, characters, genres, communities] =
      await Promise.all([
        this.prisma.novel.findMany({
          where: {
            isPublic: true,
            title: { contains: normalized, mode: 'insensitive' },
          },
          include: { author: { include: { profile: true } } },
          take: perCategoryLimit,
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
          take: perCategoryLimit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.world.findMany({
          where: {
            visibility: 'PUBLIC',
            name: { contains: normalized, mode: 'insensitive' },
          },
          include: { author: { include: { profile: true } } },
          take: perCategoryLimit,
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.character.findMany({
          where: {
            isPublic: true,
            name: { contains: normalized, mode: 'insensitive' },
          },
          include: {
            author: { include: { profile: true } },
            world: {
              select: { id: true, name: true, slug: true, visibility: true },
            },
          },
          take: perCategoryLimit,
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.genre.findMany({
          where: {
            OR: [
              { label: { contains: normalized, mode: 'insensitive' } },
              { slug: { contains: normalized, mode: 'insensitive' } },
            ],
          },
          take: perCategoryLimit,
        }),
        this.prisma.community.findMany({
          where: {
            status: 'ACTIVE',
            OR: [
              { name: { contains: normalized, mode: 'insensitive' } },
              { description: { contains: normalized, mode: 'insensitive' } },
            ],
          },
          take: perCategoryLimit,
          orderBy: { membersCount: 'desc' },
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
      ...rankByPrefix(
        genres.map((genre) => ({
          type: 'genre' as const,
          label: genre.label,
          sublabel: `Genero · ${genre.slug}`,
          url: `/novelas/genero/${genre.slug}`,
          avatar_url: null,
        })),
      ).slice(0, 2),
      ...rankByPrefix(
        communities.map((community) => ({
          type: 'community' as const,
          label: community.name,
          sublabel: `Comunidad · ${community.membersCount} miembros`,
          url: `/comunidades/${community.slug}`,
          avatar_url: community.coverUrl ?? null,
        })),
      ).slice(0, 2),
    ].slice(0, 12);

    return { suggestions };
  }

  async getHistory(userId: string) {
    return this.historySearch.getHistory(userId);
  }

  async clearHistory(userId: string) {
    return this.historySearch.clearHistory(userId);
  }

  async deleteHistoryEntry(userId: string, historyId: string) {
    return this.historySearch.deleteHistoryEntry(userId, historyId);
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
}
