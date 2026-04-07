import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChapterStatus,
  NovelRating,
  NovelStatus,
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
      language: dto.language ?? 'es',
      author: {
        connect: { id: userId },
      },
      genres: {
        create:
          dto.genreIds?.map((genreId) => ({
            genre: {
              connect: { id: genreId },
            },
          })) ?? [],
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
          ...(dto.language !== undefined ? { language: dto.language } : {}),
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

    return this.toNovelResponse(updated, userId);
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
    const where: Prisma.NovelWhereInput = {
      ...(options.authorId ? { authorId: options.authorId } : {}),
      ...(options.authorUsername
        ? {
            author: {
              username: options.authorUsername,
            },
          }
        : {}),
      ...(options.onlyPublic ? { isPublic: true } : {}),
      ...(options.query.genre
        ? {
            genres: {
              some: {
                genre: {
                  slug: options.query.genre,
                },
              },
            },
          }
        : {}),
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
      ...(options.query.language ? { language: options.query.language } : {}),
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
            item.character.isPublic || item.character.authorId === viewerId,
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
      language: novel.language,
      wordCount: novel.wordCount,
      totalWordsCount: novel.totalWordsCount,
      chaptersCount: novel.chaptersCount,
      subscribersCount: novel.subscribersCount,
      viewsCount: novel.viewsCount,
      createdAt: novel.createdAt,
      updatedAt: novel.updatedAt,
      series,
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
            characters: linkedCharacters.map((item) => ({
              id: item.character.id,
              name: item.character.name,
              slug: item.character.slug,
              avatarUrl: item.character.avatarUrl,
              role: item.character.role,
              roleInNovel: item.roleInNovel ?? item.character.role,
              status: item.character.status,
              isPublic: item.character.isPublic,
              author: {
                id: item.character.author.id,
                username: item.character.author.username,
                displayName:
                  item.character.author.profile?.displayName ??
                  item.character.author.username,
                avatarUrl: item.character.author.profile?.avatarUrl ?? null,
              },
              world:
                item.character.world &&
                (item.character.world.visibility === 'PUBLIC' ||
                  item.character.authorId === viewerId)
                  ? item.character.world
                  : null,
            })),
          }
        : {}),
    };
  }

  async listNovelCharacters(slug: string, viewerId?: string | null) {
    const novel = await this.findAccessibleNovel(slug, viewerId);

    const items = await this.prisma.novelCharacter.findMany({
      where: { novelId: novel.id },
      orderBy: [{ roleInNovel: 'asc' }, { character: { name: 'asc' } }],
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
      },
    });

    return items
      .filter(
        (item) =>
          item.character.isPublic || item.character.authorId === viewerId,
      )
      .map((item) => ({
        id: item.character.id,
        name: item.character.name,
        slug: item.character.slug,
        avatarUrl: item.character.avatarUrl,
        role: item.character.role,
        roleInNovel: item.roleInNovel ?? item.character.role,
        status: item.character.status,
        isPublic: item.character.isPublic,
        author: {
          id: item.character.author.id,
          username: item.character.author.username,
          displayName:
            item.character.author.profile?.displayName ??
            item.character.author.username,
          avatarUrl: item.character.author.profile?.avatarUrl ?? null,
        },
        world:
          item.character.world &&
          (item.character.world.visibility === 'PUBLIC' ||
            item.character.authorId === viewerId)
            ? item.character.world
            : null,
      }));
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
