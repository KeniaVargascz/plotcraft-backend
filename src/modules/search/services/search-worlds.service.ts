import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { SearchWorldsQueryDto } from '../dto/search-query.dto';
import { buildSearchQuery } from '../utils/search-query-builder.util';
import { SearchSection } from '../types/search-section.type';

@Injectable()
export class SearchWorldsService {
  constructor(private readonly prisma: PrismaService) {}

  async searchWorldsSection(
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
              ? [{ novelWorlds: { _count: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }]
              : [{ createdAt: 'desc' }, { id: 'desc' }],
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

  async searchWbEntriesSection(
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
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                icon: true,
                color: true,
              },
            },
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
        category: {
          select: { id: true, name: true, slug: true, icon: true, color: true },
        },
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

  toWorldSummary(
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

  toWbEntrySummary(
    entry: Prisma.WbEntryGetPayload<{
      include: {
        category: {
          select: { id: true; name: true; slug: true; icon: true; color: true };
        };
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
}
