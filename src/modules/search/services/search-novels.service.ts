import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { SearchNovelsQueryDto } from '../dto/search-query.dto';
import { buildSearchQuery } from '../utils/search-query-builder.util';
import { SearchSection } from '../types/search-section.type';

@Injectable()
export class SearchNovelsService {
  constructor(private readonly prisma: PrismaService) {}

  async searchNovelsSection(
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
              ? [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }]
              : query.sort === 'views'
                ? [{ viewsCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
                : [{ createdAt: 'desc' }, { id: 'desc' }],
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

    const conditions: Prisma.Sql[] = [
      Prisma.sql`n.is_public = true`,
      Prisma.sql`(n.search_vector @@ to_tsquery('spanish', ${search.tsquery}) OR n.title ILIKE ${search.ilike} OR COALESCE(n.synopsis, '') ILIKE ${search.ilike})`,
    ];

    if (query.genre) {
      conditions.push(
        Prisma.sql`EXISTS (
          SELECT 1
          FROM novel_genres ng
          JOIN genres g ON g.id = ng.genre_id
          WHERE ng.novel_id = n.id AND g.slug = ${query.genre}
        )`,
      );
    }

    if (query.rating) {
      conditions.push(Prisma.sql`n.rating = ${query.rating}::"NovelRating"`);
    }

    if (query.status) {
      conditions.push(Prisma.sql`n.status = ${query.status}::"NovelStatus"`);
    }

    const whereClause = conditions.reduce((acc, cond) =>
      Prisma.sql`${acc} AND ${cond}`,
    );

    const [rows, totalRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ id: string; score: number }>>`
        SELECT n.id,
               CASE
                 WHEN n.search_vector @@ to_tsquery('spanish', ${search.tsquery})
                   THEN ts_rank(n.search_vector, to_tsquery('spanish', ${search.tsquery}))
                 ELSE 0.05
               END AS score
        FROM novels n
        WHERE ${whereClause}
        ORDER BY score DESC, n.created_at DESC
        OFFSET ${offset}
        LIMIT ${limit}
      `,
      this.prisma.$queryRaw<Array<{ total: number }>>`
        SELECT LEAST(COUNT(*), 999)::int AS total
        FROM novels n
        WHERE ${whereClause}
      `,
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

  toNovelSummary(
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
}
