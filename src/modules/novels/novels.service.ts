import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ChapterStatus,
  CommunityStatus,
  CommunityType,
  NovelRating,
  NovelStatus,
  NovelType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateNovelDto } from './dto/create-novel.dto';
import { NovelQueryDto } from './dto/novel-query.dto';
import { UpdateNovelDto } from './dto/update-novel.dto';
import { createSlug } from './utils/slugify.util';

type NovelListOptions = {
  query: NovelQueryDto;
  viewerId?: string | null;
  authorId?: string;
  authorUsername?: string;
  onlyPublic?: boolean;
};

@Injectable()
export class NovelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createNovel(userId: string, dto: CreateNovelDto) {
    await this.assertGenresExist(dto.genreIds ?? []);
    const languageId = await this.resolveLanguageId(dto.languageId);
    await this.assertOwnsCharacters(userId, this.collectPairingCharacterIds(dto.pairings));

    const novelType = dto.novelType ?? NovelType.ORIGINAL;
    let linkedCommunityId: string | null = null;

    if (novelType === NovelType.FANFIC && dto.linkedCommunityId) {
      const community = await this.prisma.community.findUnique({
        where: { id: dto.linkedCommunityId },
      });
      if (!community) {
        throw new NotFoundException('Comunidad no encontrada.');
      }
      if (community.type !== CommunityType.FANDOM) {
        throw new UnprocessableEntityException(
          'Un fanfiction solo puede relacionarse a un Fandom',
        );
      }
      if (community.status !== CommunityStatus.ACTIVE) {
        throw new UnprocessableEntityException(
          'La comunidad Fandom debe estar activa.',
        );
      }
      linkedCommunityId = community.id;
    } else if (dto.linkedCommunityId) {
      throw new UnprocessableEntityException(
        'Las novelas originales no pueden estar ligadas a una comunidad fandom.',
      );
    }

    // FANFIC novels are auto-tagged with the "fanfiction" genre so they show up
    // in /novelas?genres=fanfiction without forcing the author to pick it manually.
    const genreIds = [...(dto.genreIds ?? [])];
    if (novelType === NovelType.FANFIC) {
      const fanfictionGenre = await this.prisma.genre.findUnique({
        where: { slug: 'fanfiction' },
        select: { id: true },
      });
      if (fanfictionGenre && !genreIds.includes(fanfictionGenre.id)) {
        genreIds.push(fanfictionGenre.id);
      }
    }

    const slug = await this.generateUniqueNovelSlug(dto.title);
    const payload: Prisma.NovelCreateInput = {
      title: dto.title.trim(),
      slug,
      synopsis: dto.synopsis?.trim() || null,
      coverUrl: dto.coverUrl?.trim() || null,
      status: dto.status ?? NovelStatus.DRAFT,
      rating: dto.rating ?? NovelRating.G,
      tags: dto.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [],
      warnings:
        dto.warnings?.map((warning) => warning.trim()).filter(Boolean) ?? [],
      isPublic: dto.isPublic ?? false,
      language: {
        connect: { id: languageId },
      },
      romanceGenres: dto.romanceGenres ?? [],
      novelType,
      ...(linkedCommunityId
        ? { linkedCommunity: { connect: { id: linkedCommunityId } } }
        : {}),
      author: {
        connect: { id: userId },
      },
      genres: {
        create: genreIds.map((genreId) => ({
          genre: {
            connect: { id: genreId },
          },
        })),
      },
    };

    if (payload.isPublic) {
      throw new BadRequestException(
        'Una novela nueva no puede publicarse sin capitulos publicados',
      );
    }

    const novel = await this.prisma.novel.create({
      data: payload,
      include: this.novelInclude(userId, false),
    });

    if (dto.pairings?.length) {
      await this.replacePairings(novel.id, dto.pairings);
    }

    return this.toNovelResponse(novel, userId);
  }

  private collectPairingCharacterIds(pairings?: { characterAId: string; characterBId: string }[]): string[] {
    if (!pairings?.length) return [];
    const ids = new Set<string>();
    for (const p of pairings) {
      ids.add(p.characterAId);
      ids.add(p.characterBId);
    }
    return Array.from(ids);
  }

  private async assertOwnsCharacters(userId: string, ids: string[]): Promise<void> {
    if (!ids.length) return;
    const characters = await this.prisma.character.findMany({
      where: { id: { in: ids } },
      select: { id: true, authorId: true },
    });
    if (characters.length !== ids.length) {
      throw new NotFoundException('Uno o mas personajes no existen');
    }
    const notOwned = characters.find((c) => c.authorId !== userId);
    if (notOwned) {
      throw new ForbiddenException(
        'Solo puedes incluir personajes propios en las parejas',
      );
    }
  }

  private async replacePairings(
    novelId: string,
    pairings: { characterAId: string; characterBId: string; isMain?: boolean }[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.novelPairing.deleteMany({ where: { novelId } }),
      ...(pairings.length
        ? [
            this.prisma.novelPairing.createMany({
              data: pairings.map((p, index) => ({
                novelId,
                characterAId: p.characterAId,
                characterBId: p.characterBId,
                isMain: p.isMain ?? false,
                sortOrder: index,
              })),
            }),
          ]
        : []),
    ]);
  }

  listPublicNovels(query: NovelQueryDto, viewerId?: string | null) {
    return this.listNovels({
      query,
      viewerId,
      onlyPublic: true,
    });
  }

  listMyNovels(userId: string, query: NovelQueryDto) {
    return this.listNovels({
      query,
      viewerId: userId,
      authorId: userId,
      onlyPublic: false,
    });
  }

  listUserNovels(
    username: string,
    query: NovelQueryDto,
    viewerId?: string | null,
  ) {
    return this.listNovels({
      query,
      viewerId,
      authorUsername: username,
      onlyPublic: true,
    });
  }

  async getNovelBySlug(slug: string, viewerId?: string | null) {
    const baseNovel = await this.prisma.novel.findUnique({
      where: { slug },
      include: {
        author: {
          include: { profile: true },
        },
      },
    });

    if (!baseNovel) {
      throw new NotFoundException('Novela no encontrada');
    }

    const isAuthor = viewerId === baseNovel.authorId;
    if (!baseNovel.isPublic && !isAuthor) {
      throw new NotFoundException('Novela no encontrada');
    }

    if (baseNovel.isPublic && !isAuthor) {
      await this.prisma.$executeRaw`
        UPDATE novels
        SET views_count = views_count + 1
        WHERE id = ${baseNovel.id}::uuid
      `;
    }

    const novel = await this.prisma.novel.findUniqueOrThrow({
      where: { id: baseNovel.id },
      include: this.novelInclude(viewerId, true, isAuthor),
    });

    const response = this.toNovelResponse(novel, viewerId, true);

    // Aggregate votes from all chapters
    const totalVotes = await this.prisma.chapter.aggregate({
      where: { novelId: baseNovel.id },
      _sum: { votesCount: true },
    });
    response.stats.votesCount = totalVotes._sum.votesCount ?? 0;

    if (viewerId && viewerId !== baseNovel.authorId && response.viewerContext) {
      const kudo = await this.prisma.novelKudo.findUnique({
        where: { novelId_userId: { novelId: baseNovel.id, userId: viewerId } },
      });
      response.viewerContext.hasKudo = !!kudo;

      const sub = await this.prisma.novelSubscription.findUnique({
        where: {
          novelId_userId: { novelId: baseNovel.id, userId: viewerId },
        },
      });
      response.viewerContext.isSubscribed = !!sub;
    }

    return response;
  }

  async updateNovel(slug: string, userId: string, dto: UpdateNovelDto) {
    const novel = await this.findOwnedNovel(slug, userId);
    const nextTitle = dto.title?.trim() ?? novel.title;

    await this.assertGenresExist(dto.genreIds ?? []);
    const languageId =
      dto.languageId !== undefined
        ? await this.resolveLanguageId(dto.languageId)
        : undefined;
    await this.assertOwnsCharacters(userId, this.collectPairingCharacterIds(dto.pairings));

    if (dto.isPublic) {
      await this.assertPublicRequirements(novel.id);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.genreIds) {
        await tx.novelGenre.deleteMany({
          where: { novelId: novel.id },
        });
      }

      return tx.novel.update({
        where: { id: novel.id },
        data: {
          ...(dto.title !== undefined
            ? {
                title: nextTitle,
                slug:
                  nextTitle !== novel.title
                    ? await this.generateUniqueNovelSlug(nextTitle, novel.id)
                    : novel.slug,
              }
            : {}),
          ...(dto.synopsis !== undefined
            ? { synopsis: dto.synopsis?.trim() || null }
            : {}),
          ...(dto.coverUrl !== undefined
            ? { coverUrl: dto.coverUrl?.trim() || null }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
          ...(dto.tags !== undefined
            ? { tags: dto.tags.map((tag) => tag.trim()).filter(Boolean) }
            : {}),
          ...(dto.warnings !== undefined
            ? {
                warnings: dto.warnings
                  .map((warning) => warning.trim())
                  .filter(Boolean),
              }
            : {}),
          ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
          ...(languageId !== undefined ? { languageId } : {}),
          ...(dto.romanceGenres !== undefined
            ? { romanceGenres: dto.romanceGenres }
            : {}),
          ...(dto.genreIds
            ? {
                genres: {
                  create: dto.genreIds.map((genreId) => ({
                    genre: {
                      connect: { id: genreId },
                    },
                  })),
                },
              }
            : {}),
        },
        include: this.novelInclude(userId, false),
      });
    });

    if (dto.pairings !== undefined) {
      await this.replacePairings(novel.id, dto.pairings);
    }

    // Re-fetch with pairings included
    const refreshed = await this.prisma.novel.findUniqueOrThrow({
      where: { id: novel.id },
      include: this.novelInclude(userId, false),
    });
    return this.toNovelResponse(refreshed, userId);
  }

  async deleteNovel(slug: string, userId: string) {
    const novel = await this.findOwnedNovel(slug, userId);
    await this.prisma.novel.delete({
      where: { id: novel.id },
    });

    return { message: 'Novela eliminada correctamente' };
  }

  async toggleLike(slug: string, userId: string) {
    const novel = await this.findAccessibleNovel(slug, userId);
    const existing = await this.prisma.novelLike.findUnique({
      where: {
        novelId_userId: {
          novelId: novel.id,
          userId,
        },
      },
    });

    if (existing) {
      await this.prisma.novelLike.delete({
        where: { id: existing.id },
      });

      return { hasLiked: false };
    }

    await this.prisma.novelLike.create({
      data: {
        novelId: novel.id,
        userId,
      },
    });

    if (novel.authorId !== userId) {
      // Check milestones: 100, 500, 1000, 5000
      const likesCount = await this.prisma.novelLike.count({ where: { novelId: novel.id } });
      const milestones = [100, 500, 1000, 5000];
      if (milestones.includes(likesCount)) {
        void this.notificationsService.createNotification({
          userId: novel.authorId,
          type: 'NOVEL_MILESTONE' as any,
          title: `Tu novela alcanzo ${likesCount} likes!`,
          body: novel.title,
          actorId: userId,
        });
      }
    }

    return { hasLiked: true };
  }

  async toggleBookmark(slug: string, userId: string) {
    const novel = await this.findAccessibleNovel(slug, userId);
    const existing = await this.prisma.novelBookmark.findUnique({
      where: {
        novelId_userId: {
          novelId: novel.id,
          userId,
        },
      },
    });

    if (existing) {
      await this.prisma.novelBookmark.delete({
        where: { id: existing.id },
      });

      return { hasBookmarked: false };
    }

    await this.prisma.novelBookmark.create({
      data: {
        novelId: novel.id,
        userId,
      },
    });

    return { hasBookmarked: true };
  }

  async recalculateNovelWordCount(novelId: string) {
    const aggregate = await this.prisma.chapter.aggregate({
      where: {
        novelId,
        status: ChapterStatus.PUBLISHED,
      },
      _sum: {
        wordCount: true,
      },
      _count: true,
    });

    const total = aggregate._sum.wordCount ?? 0;
    await this.prisma.novel.update({
      where: { id: novelId },
      data: {
        wordCount: total,
        totalWordsCount: total,
        chaptersCount: aggregate._count,
      },
    });
  }

  async findOwnedNovel(slug: string, userId: string) {
    const novel = await this.prisma.novel.findUnique({
      where: { slug },
    });

    if (!novel) {
      throw new NotFoundException('Novela no encontrada');
    }

    if (novel.authorId !== userId) {
      throw new ForbiddenException('No puedes gestionar esta novela');
    }

    return novel;
  }

  async findAccessibleNovel(slug: string, viewerId?: string | null) {
    const novel = await this.prisma.novel.findUnique({
      where: { slug },
    });

    if (!novel) {
      throw new NotFoundException('Novela no encontrada');
    }

    if (!novel.isPublic && novel.authorId !== viewerId) {
      throw new NotFoundException('Novela no encontrada');
    }

    return novel;
  }

  async findAccessibleNovelById(novelId: string, viewerId?: string | null) {
    const novel = await this.prisma.novel.findUnique({
      where: { id: novelId },
    });

    if (!novel) {
      throw new NotFoundException('Novela no encontrada');
    }

    if (!novel.isPublic && novel.authorId !== viewerId) {
      throw new NotFoundException('Novela no encontrada');
    }

    return novel;
  }

  private async listNovels(options: NovelListOptions) {
    const limit = options.query.limit ?? 12;
    let fandomCommunityId: string | undefined;
    if (options.query.fandomSlug) {
      const community = await this.prisma.community.findUnique({
        where: { slug: options.query.fandomSlug },
        select: { id: true },
      });
      fandomCommunityId = community?.id;
      if (!fandomCommunityId) {
        return {
          data: [],
          pagination: { nextCursor: null, hasMore: false, limit },
        };
      }
    }
    const where: Prisma.NovelWhereInput = {
      ...(options.query.novelType ? { novelType: options.query.novelType } : {}),
      ...(fandomCommunityId ? { linkedCommunityId: fandomCommunityId } : {}),
      ...(options.authorId ? { authorId: options.authorId } : {}),
      ...(options.authorUsername
        ? {
            author: {
              username: options.authorUsername,
            },
          }
        : {}),
      ...(options.onlyPublic ? { isPublic: true } : {}),
      ...(() => {
        const slugs = new Set<string>();
        if (options.query.genre) slugs.add(options.query.genre);
        for (const g of options.query.genres ?? []) {
          if (g) slugs.add(g);
        }
        if (slugs.size === 0) return {};
        return {
          genres: {
            some: {
              genre: {
                slug: { in: Array.from(slugs) },
              },
            },
          },
        };
      })(),
      ...(options.query.status ? { status: options.query.status } : {}),
      ...(options.query.rating ? { rating: options.query.rating } : {}),
      ...(options.query.search
        ? {
            OR: [
              {
                title: { contains: options.query.search, mode: 'insensitive' },
              },
              {
                synopsis: {
                  contains: options.query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
      ...(options.query.languageId ? { languageId: options.query.languageId } : {}),
      ...(options.query.romanceGenres?.length
        ? { romanceGenres: { hasSome: options.query.romanceGenres } }
        : {}),
    };

    if (options.query.updatedAfter || options.query.updatedBefore) {
      const range: Prisma.DateTimeFilter = {};
      if (options.query.updatedAfter) {
        range.gte = new Date(options.query.updatedAfter);
      }
      if (options.query.updatedBefore) {
        range.lte = new Date(options.query.updatedBefore);
      }
      where.updatedAt = range;
    }

    const combinedTags = [
      ...(options.query.tags ?? []),
      ...(options.query.ships ?? []).map((s) => `ship:${s}`),
    ];
    if (combinedTags.length) {
      where.tags = { hasEvery: combinedTags };
    }

    // Pairing filter: search by character names in any order
    // Multi-pairing filter: each entry is "characterA|characterB"
    // A novel matches if it has at least one pairing matching ANY of the entries (in any order)
    const pairingEntries = (options.query.pairings ?? [])
      .map((entry) => {
        const [a = '', b = ''] = entry.split('|').map((s) => s.trim());
        return { a, b };
      })
      .filter((entry) => entry.a || entry.b);

    // Backward compatibility with single pairingA/pairingB query params
    const legacyA = options.query.pairingA?.trim();
    const legacyB = options.query.pairingB?.trim();
    if (legacyA || legacyB) {
      pairingEntries.push({ a: legacyA ?? '', b: legacyB ?? '' });
    }

    if (pairingEntries.length) {
      const buildEntryClause = (entry: { a: string; b: string }) => {
        if (entry.a && entry.b) {
          return {
            OR: [
              {
                AND: [
                  { characterA: { name: { contains: entry.a, mode: 'insensitive' as const } } },
                  { characterB: { name: { contains: entry.b, mode: 'insensitive' as const } } },
                ],
              },
              {
                AND: [
                  { characterA: { name: { contains: entry.b, mode: 'insensitive' as const } } },
                  { characterB: { name: { contains: entry.a, mode: 'insensitive' as const } } },
                ],
              },
            ],
          };
        }
        const term = (entry.a || entry.b) as string;
        return {
          OR: [
            { characterA: { name: { contains: term, mode: 'insensitive' as const } } },
            { characterB: { name: { contains: term, mode: 'insensitive' as const } } },
          ],
        };
      };

      where.pairings = {
        some: {
          OR: pairingEntries.map(buildEntryClause),
        },
      };
    }

    const novels = await this.prisma.novel.findMany({
      where,
      take: limit + 1,
      ...(options.query.cursor
        ? {
            skip: 1,
            cursor: { id: options.query.cursor },
          }
        : {}),
      orderBy: this.resolveOrderBy(options.query.sortBy ?? options.query.sort),
      include: this.novelInclude(options.viewerId, false),
    });

    const hasMore = novels.length > limit;
    const items = novels.slice(0, limit);

    return {
      data: items.map((novel) => this.toNovelResponse(novel, options.viewerId)),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  private resolveOrderBy(
    sort?: NovelQueryDto['sort'] | NovelQueryDto['sortBy'],
  ): Prisma.NovelOrderByWithRelationInput[] {
    switch (sort) {
      case 'views':
        return [{ viewsCount: 'desc' }, { createdAt: 'desc' }];
      case 'popular':
        return [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }];
      case 'recently_updated':
        return [{ updatedAt: 'desc' }];
      case 'most_voted':
        return [{ votesCount: 'desc' }, { createdAt: 'desc' }];
      case 'most_kudos':
        return [{ kudosCount: 'desc' }, { createdAt: 'desc' }];
      case 'most_chapters':
        return [{ chaptersCount: 'desc' }, { createdAt: 'desc' }];
      case 'most_words':
        return [{ totalWordsCount: 'desc' }, { createdAt: 'desc' }];
      case 'newest':
      case 'recent':
      default:
        return [{ createdAt: 'desc' }];
    }
  }

  private novelInclude(
    viewerId?: string | null,
    includeChapters = false,
    includeDrafts = false,
  ) {
    return {
      author: {
        include: {
          profile: true,
        },
      },
      language: {
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
        },
      },
      genres: {
        include: {
          genre: true,
        },
      },
      likes: viewerId
        ? {
            where: { userId: viewerId },
            select: { id: true },
          }
        : false,
      bookmarks: viewerId
        ? {
            where: { userId: viewerId },
            select: { id: true },
          }
        : false,
      readingProgress: viewerId
        ? {
            where: {
              userId: viewerId,
            },
            include: {
              chapter: {
                select: {
                  id: true,
                  slug: true,
                  title: true,
                  order: true,
                },
              },
            },
          }
        : false,
      chapters: includeChapters
        ? {
            where: includeDrafts
              ? undefined
              : {
                  status: ChapterStatus.PUBLISHED,
                },
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
          }
        : {
            where: {
              status: ChapterStatus.PUBLISHED,
            },
            select: { id: true },
          },
      novelWorlds: {
        include: {
          world: {
            include: {
              author: {
                include: {
                  profile: true,
                },
              },
            },
          },
        },
      },
      novelCharacters: {
        include: {
          character: {
            include: {
              author: {
                include: {
                  profile: true,
                },
              },
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
        },
      },
    } satisfies Prisma.NovelInclude;
  }

  private toNovelResponse(
    novel: Prisma.NovelGetPayload<{
      include: ReturnType<NovelsService['novelInclude']>;
    }>,
    viewerId?: string | null,
    includeChapters = false,
  ) {
    const chapters = Array.isArray(novel.chapters) ? novel.chapters : [];
    const likes = Array.isArray(novel.likes) ? novel.likes : [];
    const bookmarks = Array.isArray(novel.bookmarks) ? novel.bookmarks : [];
    const readingProgress = Array.isArray(novel.readingProgress)
      ? novel.readingProgress
      : [];
    const readingProgressItem = readingProgress[0] as unknown as
      | {
          chapterId: string;
          scrollPct: number;
          chapter: {
            slug: string;
            title: string;
            order: number;
          };
        }
      | undefined;
    const chapterItems = includeChapters
      ? (chapters as Array<{
          id: string;
          title: string;
          slug: string;
          order: number;
          status: ChapterStatus;
          wordCount: number;
          publishedAt: Date | null;
          updatedAt: Date;
        }>)
      : [];
    const linkedWorlds = includeChapters
      ? novel.novelWorlds.filter(
          (item) =>
            item.world.visibility === 'PUBLIC' ||
            item.world.authorId === viewerId,
        )
      : [];
    const linkedCharacters = includeChapters
      ? novel.novelCharacters.filter(
          (item) =>
            item.communityCharacter ||
            (item.character &&
              (item.character.isPublic || item.character.authorId === viewerId)),
        )
      : [];

    const seriesNovel = novel.seriesNovels?.[0];
    const series = seriesNovel
      ? {
          id: seriesNovel.series.id,
          title: seriesNovel.series.title,
          slug: seriesNovel.series.slug,
          type: seriesNovel.series.type,
          status: seriesNovel.series.status,
          novelsCount: seriesNovel.series._count.novels,
          orderIndex: seriesNovel.orderIndex,
        }
      : null;

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
      languageId: novel.languageId,
      language: novel.language
        ? {
            id: novel.language.id,
            code: novel.language.code,
            name: novel.language.name,
            description: novel.language.description,
          }
        : null,
      romanceGenres: novel.romanceGenres ?? [],
      novelType: novel.novelType,
      linkedCommunityId: novel.linkedCommunityId,
      linkedCommunity: novel.linkedCommunity ?? null,
      wordCount: novel.wordCount,
      totalWordsCount: novel.totalWordsCount,
      chaptersCount: novel.chaptersCount,
      subscribersCount: novel.subscribersCount,
      viewsCount: novel.viewsCount,
      createdAt: novel.createdAt,
      updatedAt: novel.updatedAt,
      series,
      pairings: (novel.pairings ?? []).map((p) => ({
        id: p.id,
        isMain: p.isMain,
        sortOrder: p.sortOrder,
        characterA: p.characterA,
        characterB: p.characterB,
      })),
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
        publishedChaptersCount: chapters.length,
        likesCount: novel._count.likes,
        bookmarksCount: novel._count.bookmarks,
        worldsCount: novel._count.novelWorlds,
        charactersCount: novel._count.novelCharacters,
        kudosCount: novel.kudosCount,
        votesCount: 0,
      },
      viewerContext: viewerId
        ? {
            hasLiked: Boolean(likes.length),
            hasBookmarked: Boolean(bookmarks.length),
            hasKudo: false,
            isSubscribed: false,
            isAuthor: novel.authorId === viewerId,
            reading_progress: readingProgressItem
              ? {
                  chapter_id: readingProgressItem.chapterId,
                  chapter_slug: readingProgressItem.chapter.slug,
                  chapter_title: readingProgressItem.chapter.title,
                  chapter_order: readingProgressItem.chapter.order,
                  scroll_pct: readingProgressItem.scrollPct,
                }
              : null,
          }
        : null,
      ...(includeChapters
        ? {
            chapters: chapterItems.map((chapter) => ({
              id: chapter.id,
              title: chapter.title,
              slug: chapter.slug,
              order: chapter.order,
              status:
                'status' in chapter ? chapter.status : ChapterStatus.PUBLISHED,
              wordCount: chapter.wordCount,
              publishedAt: chapter.publishedAt,
              updatedAt: chapter.updatedAt,
            })),
            worlds: linkedWorlds.map((item) => ({
              id: item.world.id,
              name: item.world.name,
              slug: item.world.slug,
              tagline: item.world.tagline,
              coverUrl: item.world.coverUrl,
              visibility: item.world.visibility,
              author: {
                id: item.world.author.id,
                username: item.world.author.username,
                displayName:
                  item.world.author.profile?.displayName ??
                  item.world.author.username,
                avatarUrl: item.world.author.profile?.avatarUrl ?? null,
              },
            })),
            characters: linkedCharacters.map((item) => {
              if (item.communityCharacter) {
                return {
                  id: item.communityCharacter.id,
                  name: item.communityCharacter.name,
                  slug: null,
                  avatarUrl: item.communityCharacter.avatarUrl,
                  role: null,
                  roleInNovel: item.roleInNovel ?? null,
                  status: item.communityCharacter.status,
                  isPublic: true,
                  source: 'community' as const,
                  communityCharacterId: item.communityCharacter.id,
                  author: null,
                  world: null,
                };
              }
              const ch = item.character!;
              return {
                id: ch.id,
                name: ch.name,
                slug: ch.slug,
                avatarUrl: ch.avatarUrl,
                role: ch.role,
                roleInNovel: item.roleInNovel ?? ch.role,
                status: ch.status,
                isPublic: ch.isPublic,
                source: 'character' as const,
                communityCharacterId: null,
                author: {
                  id: ch.author.id,
                  username: ch.author.username,
                  displayName:
                    ch.author.profile?.displayName ?? ch.author.username,
                  avatarUrl: ch.author.profile?.avatarUrl ?? null,
                },
                world:
                  ch.world &&
                  (ch.world.visibility === 'PUBLIC' ||
                    ch.authorId === viewerId)
                    ? ch.world
                    : null,
              };
            }),
          }
        : {}),
    };
  }

  async linkNovelCharacter(
    slug: string,
    userId: string,
    dto: {
      characterId?: string;
      communityCharacterId?: string;
      roleInNovel?: any;
    },
  ) {
    const novel = await this.findOwnedNovel(slug, userId);

    const hasChar = !!dto.characterId;
    const hasCC = !!dto.communityCharacterId;
    if (!hasChar && !hasCC) {
      throw new BadRequestException(
        'Debes indicar characterId o communityCharacterId.',
      );
    }
    if (hasChar && hasCC) {
      throw new BadRequestException(
        'No puedes indicar characterId y communityCharacterId a la vez.',
      );
    }

    if (hasCC) {
      if (novel.novelType !== NovelType.FANFIC) {
        throw new UnprocessableEntityException(
          'Solo los fanfics pueden vincular personajes del catálogo de una comunidad.',
        );
      }
      const cc = await this.prisma.communityCharacter.findUnique({
        where: { id: dto.communityCharacterId! },
      });
      if (!cc || cc.communityId !== novel.linkedCommunityId) {
        throw new UnprocessableEntityException(
          'Este personaje no pertenece al fandom de esta novela.',
        );
      }
      if (cc.status !== 'ACTIVE') {
        throw new UnprocessableEntityException(
          'Solo puedes vincular personajes aprobados del catálogo.',
        );
      }

      const existing = await this.prisma.novelCharacter.findUnique({
        where: {
          novelId_communityCharacterId: {
            novelId: novel.id,
            communityCharacterId: cc.id,
          },
        },
      });
      if (existing) {
        return { linked: true, id: existing.id };
      }

      const created = await this.prisma.novelCharacter.create({
        data: {
          novelId: novel.id,
          communityCharacterId: cc.id,
          roleInNovel: dto.roleInNovel ?? null,
        },
      });
      return { linked: true, id: created.id };
    }

    // characterId path
    const character = await this.prisma.character.findUnique({
      where: { id: dto.characterId! },
    });
    if (!character) {
      throw new NotFoundException('Personaje no encontrado.');
    }
    if (character.authorId !== userId) {
      throw new ForbiddenException(
        'Solo puedes vincular personajes propios a tus novelas.',
      );
    }

    const existing = await this.prisma.novelCharacter.findUnique({
      where: {
        novelId_characterId: {
          novelId: novel.id,
          characterId: character.id,
        },
      },
    });
    if (existing) {
      return { linked: true, id: existing.id };
    }
    const created = await this.prisma.novelCharacter.create({
      data: {
        novelId: novel.id,
        characterId: character.id,
        roleInNovel: dto.roleInNovel ?? character.role,
      },
    });
    return { linked: true, id: created.id };
  }

  async unlinkNovelCharacter(
    slug: string,
    userId: string,
    novelCharacterId: string,
  ) {
    const novel = await this.findOwnedNovel(slug, userId);
    const nc = await this.prisma.novelCharacter.findUnique({
      where: { id: novelCharacterId },
    });
    if (!nc || nc.novelId !== novel.id) {
      throw new NotFoundException('Vínculo no encontrado.');
    }
    await this.prisma.novelCharacter.delete({ where: { id: nc.id } });
    return { unlinked: true };
  }

  async listNovelCharacters(slug: string, viewerId?: string | null) {
    const novel = await this.findAccessibleNovel(slug, viewerId);

    const items = await this.prisma.novelCharacter.findMany({
      where: { novelId: novel.id },
      orderBy: [{ roleInNovel: 'asc' }],
      include: {
        character: {
          include: {
            author: {
              include: {
                profile: true,
              },
            },
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
    });

    const communityItems = items
      .filter((item) => item.communityCharacter)
      .map((item) => ({
        id: item.communityCharacter!.id,
        novelCharacterId: item.id,
        name: item.communityCharacter!.name,
        slug: null,
        avatarUrl: item.communityCharacter!.avatarUrl,
        description: item.communityCharacter!.description,
        role: null,
        roleInNovel: item.roleInNovel ?? null,
        status: item.communityCharacter!.status,
        isPublic: true,
        source: 'community' as const,
        communityCharacterId: item.communityCharacter!.id,
        author: null,
        world: null,
      }));

    const characterItems = items
      .filter(
        (item) =>
          item.character &&
          (item.character.isPublic || item.character.authorId === viewerId),
      )
      .map((item) => {
        const ch = item.character!;
        return {
          id: ch.id,
          novelCharacterId: item.id,
          name: ch.name,
          slug: ch.slug,
          avatarUrl: ch.avatarUrl,
          description: null,
          role: ch.role,
          roleInNovel: item.roleInNovel ?? ch.role,
          status: ch.status,
          isPublic: ch.isPublic,
          source: 'character' as const,
          communityCharacterId: null,
          author: {
            id: ch.author.id,
            username: ch.author.username,
            displayName:
              ch.author.profile?.displayName ?? ch.author.username,
            avatarUrl: ch.author.profile?.avatarUrl ?? null,
          },
          world:
            ch.world &&
            (ch.world.visibility === 'PUBLIC' || ch.authorId === viewerId)
              ? ch.world
              : null,
        };
      });

    return [...characterItems, ...communityItems];
  }

  private async generateUniqueNovelSlug(title: string, ignoreNovelId?: string) {
    const baseSlug = createSlug(title);
    let candidate = baseSlug;
    let suffix = 2;

    while (true) {
      const existing = await this.prisma.novel.findUnique({
        where: { slug: candidate },
      });

      if (!existing || existing.id === ignoreNovelId) {
        return candidate;
      }

      candidate = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
  }

  private async assertGenresExist(genreIds: string[]) {
    if (!genreIds.length) {
      return;
    }

    const count = await this.prisma.genre.count({
      where: {
        id: {
          in: genreIds,
        },
      },
    });

    if (count !== genreIds.length) {
      throw new BadRequestException('Uno o mas generos no existen');
    }
  }

  private async resolveLanguageId(languageId?: string) {
    if (languageId) {
      const language = await this.prisma.catalogLanguage.findUnique({
        where: { id: languageId },
        select: { id: true, isActive: true },
      });

      if (!language || !language.isActive) {
        throw new BadRequestException('El idioma seleccionado no existe');
      }

      return language.id;
    }

    const fallback = await this.prisma.catalogLanguage.findUnique({
      where: { code: 'es' },
      select: { id: true, isActive: true },
    });

    if (!fallback || !fallback.isActive) {
      throw new BadRequestException('No existe un idioma por defecto configurado');
    }

    return fallback.id;
  }

  private async assertPublicRequirements(novelId: string) {
    const publishedChapters = await this.prisma.chapter.count({
      where: {
        novelId,
        status: ChapterStatus.PUBLISHED,
      },
    });

    if (!publishedChapters) {
      throw new BadRequestException(
        'La novela necesita al menos un capitulo publicado para ser publica',
      );
    }
  }
}
