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
import { CreateNovelDto } from './dto/create-novel.dto';
import { NovelQueryDto } from './dto/novel-query.dto';
import { UpdateNovelDto } from './dto/update-novel.dto';
import { createSlug } from './utils/slugify.util';
import { generateUniqueSlug } from '../../common/utils/unique-slug.util';
import { novelCardInclude, novelFullCardInclude, novelDetailInclude } from './novel-projections';
import { NovelValidationService } from './services/novel-validation.service';

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
    private readonly novelValidationService: NovelValidationService,
  ) {}

  async createNovel(userId: string, dto: CreateNovelDto) {
    await this.novelValidationService.assertGenresExist(dto.genreIds ?? []);
    const languageId = await this.novelValidationService.resolveLanguageId(dto.languageId);
    await this.novelValidationService.assertOwnsCharacters(
      userId,
      this.novelValidationService.collectPairingCharacterIds(dto.pairings),
    );

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
      ...(dto.warning_ids?.length
        ? {
            novelWarnings: {
              create: dto.warning_ids.map((id) => ({
                warning: { connect: { id } },
              })),
            },
          }
        : {}),
      ...(dto.romanceGenreIds?.length
        ? {
            romanceGenres: {
              create: dto.romanceGenreIds.map((id) => ({
                romanceGenre: { connect: { id } },
              })),
            },
          }
        : {}),
      novelType,
      isAlternateUniverse: dto.isAlternateUniverse ?? false,
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
      include: novelFullCardInclude(userId),
    });

    if (dto.pairings?.length) {
      await this.novelValidationService.replacePairings(novel.id, dto.pairings);
    }

    return this.toNovelResponse(novel, userId);
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
      include: novelDetailInclude(viewerId, isAuthor),
    });

    const response = this.toNovelResponse(novel, viewerId, true);

    // Aggregate votes from all chapters
    const totalVotes = await this.prisma.chapter.aggregate({
      where: { novelId: baseNovel.id },
      _sum: { votesCount: true },
    });
    response.stats.votesCount = totalVotes._sum.votesCount ?? 0;

    if (viewerId && viewerId !== baseNovel.authorId && response.viewerContext) {
      const [kudo, sub] = await Promise.all([
        this.prisma.novelKudo.findUnique({
          where: {
            novelId_userId: { novelId: baseNovel.id, userId: viewerId },
          },
        }),
        this.prisma.novelSubscription.findUnique({
          where: {
            novelId_userId: { novelId: baseNovel.id, userId: viewerId },
          },
        }),
      ]);
      response.viewerContext.hasKudo = !!kudo;
      response.viewerContext.isSubscribed = !!sub;
    }

    return response;
  }

  async updateNovel(slug: string, userId: string, dto: UpdateNovelDto) {
    const novel = await this.findOwnedNovel(slug, userId);
    const nextTitle = dto.title?.trim() ?? novel.title;

    await this.novelValidationService.assertGenresExist(dto.genreIds ?? []);
    const languageId =
      dto.languageId !== undefined
        ? await this.novelValidationService.resolveLanguageId(dto.languageId)
        : undefined;
    await this.novelValidationService.assertOwnsCharacters(
      userId,
      this.novelValidationService.collectPairingCharacterIds(dto.pairings),
    );

    if (dto.isPublic) {
      await this.novelValidationService.assertPublicRequirements(novel.id);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.genreIds) {
        await tx.novelGenre.deleteMany({
          where: { novelId: novel.id },
        });
      }

      if (dto.romanceGenreIds !== undefined) {
        await tx.novelRomanceGenre.deleteMany({
          where: { novelId: novel.id },
        });
      }

      if (dto.warning_ids !== undefined) {
        await tx.novelWarning.deleteMany({
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
          ...(dto.warning_ids !== undefined && dto.warning_ids.length
            ? {
                novelWarnings: {
                  create: dto.warning_ids.map((id) => ({
                    warning: { connect: { id } },
                  })),
                },
              }
            : {}),
          ...(dto.romanceGenreIds !== undefined && dto.romanceGenreIds.length
            ? {
                romanceGenres: {
                  create: dto.romanceGenreIds.map((id) => ({
                    romanceGenre: { connect: { id } },
                  })),
                },
              }
            : {}),
          ...(dto.isAlternateUniverse !== undefined
            ? { isAlternateUniverse: dto.isAlternateUniverse }
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
        include: novelFullCardInclude(userId),
      });
    });

    if (dto.pairings !== undefined) {
      await this.novelValidationService.replacePairings(novel.id, dto.pairings);
    }

    // Re-fetch with pairings included
    const refreshed = await this.prisma.novel.findUniqueOrThrow({
      where: { id: novel.id },
      include: novelFullCardInclude(userId),
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
      ...(options.query.novelType
        ? { novelType: options.query.novelType }
        : {}),
      ...(fandomCommunityId ? { linkedCommunityId: fandomCommunityId } : {}),
      ...(options.authorId ? { authorId: options.authorId } : {}),
      ...(options.authorUsername
        ? {
            author: {
              username: options.authorUsername,
            },
          }
        : {}),
      ...(options.onlyPublic ? { isPublic: true, status: { not: 'DRAFT' as const } } : {}),
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
      ...(options.query.languageId
        ? { languageId: options.query.languageId }
        : {}),
      ...(options.query.romanceGenreIds?.length
        ? {
            romanceGenres: {
              some: { romanceGenreId: { in: options.query.romanceGenreIds } },
            },
          }
        : {}),
      ...(options.query.warningIds?.length
        ? {
            novelWarnings: {
              some: { warningId: { in: options.query.warningIds } },
            },
          }
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
                  {
                    characterA: {
                      name: { contains: entry.a, mode: 'insensitive' as const },
                    },
                  },
                  {
                    characterB: {
                      name: { contains: entry.b, mode: 'insensitive' as const },
                    },
                  },
                ],
              },
              {
                AND: [
                  {
                    characterA: {
                      name: { contains: entry.b, mode: 'insensitive' as const },
                    },
                  },
                  {
                    characterB: {
                      name: { contains: entry.a, mode: 'insensitive' as const },
                    },
                  },
                ],
              },
            ],
          };
        }
        const term = entry.a || entry.b;
        return {
          OR: [
            {
              characterA: {
                name: { contains: term, mode: 'insensitive' as const },
              },
            },
            {
              characterB: {
                name: { contains: term, mode: 'insensitive' as const },
              },
            },
          ],
        };
      };

      where.pairings = {
        some: {
          OR: pairingEntries.map(buildEntryClause),
        },
      };
    }

    const page = options.query.page ?? 1;

    // If page-based pagination is requested, use offset approach with total count
    if (options.query.page) {
      const [novels, total] = await Promise.all([
        this.prisma.novel.findMany({
          where,
          take: limit,
          skip: (page - 1) * limit,
          orderBy: this.resolveOrderBy(
            options.query.sortBy ?? options.query.sort,
          ),
          include: novelCardInclude(options.viewerId),
        }),
        this.prisma.novel.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: novels.map((novel) =>
          this.toNovelResponse(novel, options.viewerId),
        ),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages,
        },
      };
    }

    // Fallback: cursor-based pagination (for backward compatibility)
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
      include: novelCardInclude(options.viewerId),
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
    sort?: NovelQueryDto['sort'],
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


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toNovelResponse(novel: any, viewerId?: string | null, includeChapters = false) {
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
          (item: any) =>
            item.world.visibility === 'PUBLIC' ||
            item.world.authorId === viewerId,
        )
      : [];
    const linkedCharacters = includeChapters
      ? novel.novelCharacters.filter(
          (item: any) =>
            item.communityCharacter ||
            (item.character &&
              (item.character.isPublic ||
                item.character.authorId === viewerId)),
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
      warnings: (novel as any).novelWarnings?.map((nw: any) => ({
        id: nw.warning.id,
        slug: nw.warning.slug,
        label: nw.warning.label,
      })) ?? novel.warnings.map((w: string) => ({ id: w, slug: w, label: w })),
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
      romanceGenres:
        novel.romanceGenres?.map((rg: any) => ({
          id: rg.romanceGenre.id,
          slug: rg.romanceGenre.slug,
          label: rg.romanceGenre.label,
        })) ?? [],
      novelType: novel.novelType,
      isAlternateUniverse: novel.isAlternateUniverse,
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
      pairings: (novel.pairings ?? []).map((p: any) => ({
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
      genres: novel.genres.map((item: any) => ({
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
        commentsCount: novel._count.novelComments,
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
            readingProgress: readingProgressItem
              ? {
                  chapterId: readingProgressItem.chapterId,
                  chapterSlug: readingProgressItem.chapter.slug,
                  chapterTitle: readingProgressItem.chapter.title,
                  chapterOrder: readingProgressItem.chapter.order,
                  scrollPct: readingProgressItem.scrollPct,
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
            worlds: linkedWorlds.map((item: any) => ({
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
            communityCharacters: linkedCharacters
              .filter((item: any) => item.communityCharacter)
              .map((item: any) => ({
                id: item.communityCharacter!.id,
                name: item.communityCharacter!.name,
                avatarUrl: item.communityCharacter!.avatarUrl,
                roleInNovel: item.roleInNovel ?? null,
                status: item.communityCharacter!.status,
              })),
            characters: linkedCharacters
              .filter((item: any) => !item.communityCharacter && item.character)
              .map((item: any) => {
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

  private async generateUniqueNovelSlug(title: string, ignoreNovelId?: string) {
    return generateUniqueSlug(this.prisma, {
      title,
      model: 'novel',
      ignoreId: ignoreNovelId,
    });
  }
}
