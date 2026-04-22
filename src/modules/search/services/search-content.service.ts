import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  SearchCharactersQueryDto,
  SearchUsersQueryDto,
  SearchPostsQueryDto,
} from '../dto/search-query.dto';
import { buildSearchQuery } from '../utils/search-query-builder.util';
import { SearchSection } from '../types/search-section.type';

@Injectable()
export class SearchContentService {
  constructor(private readonly prisma: PrismaService) {}

  async searchCharactersSection(
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
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
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

  async searchUsersSection(
    query: SearchUsersQueryDto,
    offset = 0,
  ): Promise<SearchSection> {
    const limit = query.limit ?? 20;
    const search = buildSearchQuery(query.q);
    const where: Prisma.UserWhereInput = {
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
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
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
        take: Math.min(offset + limit + 20, 100),
      }),
      this.prisma.user.count({ where }),
    ]);

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
      total_hint: Math.min(total, 999),
    };
  }

  async searchPostsSection(
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
              ? [{ reactions: { _count: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }]
              : [{ createdAt: 'desc' }, { id: 'desc' }],
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
             END AS score
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

  toCharacterSummary(
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

  toUserSearchResult(
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
      displayName: user.profile?.displayName ?? user.username,
      avatarUrl: user.profile?.avatarUrl ?? null,
      bio: user.profile?.bio ?? null,
      stats: {
        followersCount: user._count.followers,
        novelsCount: user._count.novels,
        worldsCount: user._count.worlds,
      },
    };
  }

  toPostSearchResult(
    post: Prisma.PostGetPayload<{
      include: {
        author: { include: { profile: true } };
        _count: { select: { reactions: true; comments: true } };
      };
    }>,
  ) {
    return {
      id: post.id,
      contentExcerpt: post.content.slice(0, 200),
      type: post.type,
      createdAt: post.createdAt,
      author: {
        username: post.author.username,
        displayName: post.author.profile?.displayName ?? post.author.username,
        avatarUrl: post.author.profile?.avatarUrl ?? null,
      },
      stats: {
        reactionsCount: post._count.reactions,
        commentsCount: post._count.comments,
      },
    };
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
}
