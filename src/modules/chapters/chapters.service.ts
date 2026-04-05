import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChapterStatus, Prisma } from '@prisma/client';
import { NovelsService } from '../novels/novels.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ChapterQueryDto } from './dto/chapter-query.dto';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { ReorderChaptersDto } from './dto/reorder-chapters.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { countWords, stripMarkdown } from '../novels/utils/word-count.util';
import { createSlug } from '../novels/utils/slugify.util';

@Injectable()
export class ChaptersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly novelsService: NovelsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createChapter(
    novelSlug: string,
    userId: string,
    dto: CreateChapterDto,
  ) {
    const novel = await this.novelsService.findOwnedNovel(novelSlug, userId);
    this.assertChapterContent(dto.content);

    const aggregate = await this.prisma.chapter.aggregate({
      where: { novelId: novel.id },
      _max: { order: true },
    });

    const chapter = await this.prisma.chapter.create({
      data: {
        novelId: novel.id,
        authorId: userId,
        title: dto.title.trim(),
        slug: await this.generateUniqueChapterSlug(novel.id, dto.title),
        content: dto.content,
        order: (aggregate._max.order ?? 0) + 1,
        wordCount: countWords(dto.content),
      },
      include: this.chapterInclude(),
    });

    return this.toChapterDetailResponse(chapter);
  }

  async listPublishedChapters(novelSlug: string, query: ChapterQueryDto) {
    const novel = await this.novelsService.findAccessibleNovel(novelSlug, null);
    if (!novel.isPublic) {
      throw new NotFoundException('Novela no encontrada');
    }

    return this.listChapters(novel.id, query, false);
  }

  async listDraftChapters(
    novelSlug: string,
    userId: string,
    query: ChapterQueryDto,
  ) {
    const novel = await this.novelsService.findOwnedNovel(novelSlug, userId);
    return this.listChapters(novel.id, query, true);
  }

  async getPublishedChapter(novelSlug: string, chapterSlug: string) {
    const chapter = await this.prisma.chapter.findFirst({
      where: {
        slug: chapterSlug,
        status: ChapterStatus.PUBLISHED,
        novel: {
          slug: novelSlug,
          isPublic: true,
        },
      },
      include: this.chapterInclude(true),
    });

    if (!chapter) {
      throw new NotFoundException('Capitulo no encontrado');
    }

    return this.toChapterDetailResponse(chapter, true);
  }

  async getOwnedChapter(
    novelSlug: string,
    chapterSlug: string,
    userId: string,
  ) {
    const chapter = await this.findOwnedChapter(novelSlug, chapterSlug, userId);
    return this.toChapterDetailResponse(chapter);
  }

  async updateChapter(
    novelSlug: string,
    chapterSlug: string,
    userId: string,
    dto: UpdateChapterDto,
  ) {
    const chapter = await this.findOwnedChapter(novelSlug, chapterSlug, userId);
    const title = dto.title?.trim() ?? chapter.title;
    const content = dto.content ?? chapter.content;

    if (dto.content !== undefined) {
      this.assertChapterContent(content);
    }

    const updated = await this.prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        ...(dto.title !== undefined
          ? {
              title,
              slug:
                title !== chapter.title
                  ? await this.generateUniqueChapterSlug(
                      chapter.novelId,
                      title,
                      chapter.id,
                    )
                  : chapter.slug,
            }
          : {}),
        ...(dto.content !== undefined ? { content } : {}),
        ...(dto.content !== undefined
          ? { wordCount: countWords(content) }
          : {}),
      },
      include: this.chapterInclude(),
    });

    if (updated.status === ChapterStatus.PUBLISHED) {
      await this.novelsService.recalculateNovelWordCount(updated.novelId);
    }

    return this.toChapterDetailResponse(updated);
  }

  async autosaveChapter(
    novelSlug: string,
    chapterSlug: string,
    userId: string,
    dto: UpdateChapterDto,
  ) {
    const chapter = await this.findOwnedChapter(novelSlug, chapterSlug, userId);
    const nextContent = dto.content ?? chapter.content;

    if (dto.content !== undefined) {
      this.assertChapterContent(nextContent);
    }

    const updated = await this.prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.content !== undefined ? { content: nextContent } : {}),
        ...(dto.content !== undefined
          ? { wordCount: countWords(nextContent) }
          : {}),
      },
      select: {
        updatedAt: true,
        wordCount: true,
      },
    });

    return {
      savedAt: updated.updatedAt,
      wordCount: updated.wordCount,
    };
  }

  async deleteChapter(novelSlug: string, chapterSlug: string, userId: string) {
    const chapter = await this.findOwnedChapter(novelSlug, chapterSlug, userId);

    await this.prisma.chapter.delete({
      where: { id: chapter.id },
    });

    await this.novelsService.recalculateNovelWordCount(chapter.novelId);

    return { message: 'Capitulo eliminado correctamente' };
  }

  async publishChapter(novelSlug: string, chapterSlug: string, userId: string) {
    const chapter = await this.findOwnedChapter(novelSlug, chapterSlug, userId);
    const publishedAt = new Date();

    this.assertChapterContent(chapter.content);

    const updated = await this.prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        status: ChapterStatus.PUBLISHED,
        publishedAt,
        scheduledAt: null,
        contentSnapshot: {
          version: 1,
          content: chapter.content,
          wordCount: chapter.wordCount,
          publishedAt: publishedAt.toISOString(),
        },
      },
      include: this.chapterInclude(),
    });

    await this.novelsService.recalculateNovelWordCount(chapter.novelId);

    // Notify followers of the author about the new chapter
    const followers = await this.prisma.follow.findMany({
      where: { followingId: userId },
      select: { followerId: true },
      take: 100,
    });
    // TODO: In production, use a queue system for large follower counts
    for (const f of followers) {
      void this.notificationsService.createNotification({
        userId: f.followerId,
        type: 'NEW_CHAPTER' as any,
        title: `Nuevo capitulo publicado`,
        body: `${updated.title} en ${updated.novel.title}`,
        url: `/novelas/${updated.novel.slug}/${updated.slug}`,
        actorId: userId,
      });
    }

    return this.toChapterDetailResponse(updated);
  }

  async unpublishChapter(
    novelSlug: string,
    chapterSlug: string,
    userId: string,
  ) {
    const chapter = await this.findOwnedChapter(novelSlug, chapterSlug, userId);

    const updated = await this.prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        status: ChapterStatus.DRAFT,
        publishedAt: null,
        scheduledAt: null,
      },
      include: this.chapterInclude(),
    });

    await this.novelsService.recalculateNovelWordCount(chapter.novelId);

    return this.toChapterDetailResponse(updated);
  }

  async scheduleChapter(
    novelSlug: string,
    chapterSlug: string,
    userId: string,
    scheduledAt: string,
  ) {
    const chapter = await this.findOwnedChapter(novelSlug, chapterSlug, userId);
    const date = new Date(scheduledAt);

    if (Number.isNaN(date.getTime()) || date <= new Date()) {
      throw new BadRequestException(
        'La fecha programada debe estar en el futuro',
      );
    }

    const updated = await this.prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        status: ChapterStatus.SCHEDULED,
        scheduledAt: date,
      },
      include: this.chapterInclude(),
    });

    return this.toChapterDetailResponse(updated);
  }

  async reorderChapters(
    novelSlug: string,
    userId: string,
    dto: ReorderChaptersDto,
  ) {
    const novel = await this.novelsService.findOwnedNovel(novelSlug, userId);
    const chapters = await this.prisma.chapter.findMany({
      where: { novelId: novel.id },
      orderBy: { order: 'asc' },
    });

    if (
      chapters.some((chapter) => chapter.status === ChapterStatus.PUBLISHED)
    ) {
      throw new ForbiddenException(
        'No puedes reordenar capitulos mientras existan capitulos publicados',
      );
    }

    if (chapters.length !== dto.chapters.length) {
      throw new BadRequestException(
        'Debes incluir todos los capitulos en el reorden',
      );
    }

    const requestedIds = new Set(dto.chapters.map((item) => item.id));
    if (requestedIds.size !== chapters.length) {
      throw new BadRequestException(
        'La lista de capitulos contiene ids duplicados',
      );
    }

    for (const chapter of chapters) {
      if (!requestedIds.has(chapter.id)) {
        throw new BadRequestException(
          'Debes incluir todos los capitulos en el reorden',
        );
      }
    }

    const offsetBase = chapters.length + 100;

    await this.prisma.$transaction(async (tx) => {
      for (const [index, item] of dto.chapters.entries()) {
        await tx.chapter.update({
          where: { id: item.id },
          data: { order: offsetBase + index },
        });
      }

      for (const item of dto.chapters) {
        await tx.chapter.update({
          where: { id: item.id },
          data: { order: item.order },
        });
      }
    });

    return this.listDraftChapters(novelSlug, userId, {});
  }

  private async listChapters(
    novelId: string,
    query: ChapterQueryDto,
    includeDrafts: boolean,
  ) {
    const limit = query.limit ?? 50;
    const where: Prisma.ChapterWhereInput = {
      novelId,
      ...(includeDrafts
        ? {}
        : {
            status: ChapterStatus.PUBLISHED,
          }),
    };

    const chapters = await this.prisma.chapter.findMany({
      where,
      take: limit + 1,
      ...(query.cursor
        ? {
            skip: 1,
            cursor: { id: query.cursor },
          }
        : {}),
      orderBy: { order: 'asc' },
      include: this.chapterInclude(),
    });

    const hasMore = chapters.length > limit;
    const items = chapters.slice(0, limit);

    return {
      data: items.map((chapter) => this.toChapterListResponse(chapter)),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  private async findOwnedChapter(
    novelSlug: string,
    chapterSlug: string,
    userId: string,
  ) {
    await this.novelsService.findOwnedNovel(novelSlug, userId);

    const chapter = await this.prisma.chapter.findFirst({
      where: {
        slug: chapterSlug,
        authorId: userId,
        novel: {
          slug: novelSlug,
        },
      },
      include: this.chapterInclude(true),
    });

    if (!chapter) {
      throw new NotFoundException('Capitulo no encontrado');
    }

    return chapter;
  }

  private async generateUniqueChapterSlug(
    novelId: string,
    title: string,
    ignoreChapterId?: string,
  ) {
    const baseSlug = createSlug(title);
    let candidate = baseSlug;
    let suffix = 2;

    while (true) {
      const existing = await this.prisma.chapter.findFirst({
        where: {
          novelId,
          slug: candidate,
        },
      });

      if (!existing || existing.id === ignoreChapterId) {
        return candidate;
      }

      candidate = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
  }

  private assertChapterContent(content: string) {
    if (!stripMarkdown(content).trim()) {
      throw new BadRequestException('El capitulo no puede quedar vacio');
    }
  }

  private chapterInclude(includeNavigation = false) {
    return {
      novel: {
        include: {
          author: {
            include: {
              profile: true,
            },
          },
          ...(includeNavigation
            ? {
                chapters: {
                  where: {
                    status: ChapterStatus.PUBLISHED,
                  },
                  orderBy: {
                    order: 'asc' as const,
                  },
                  select: {
                    id: true,
                    slug: true,
                    title: true,
                    order: true,
                  },
                },
              }
            : {}),
        },
      },
    } satisfies Prisma.ChapterInclude;
  }

  private toChapterListResponse(
    chapter: Prisma.ChapterGetPayload<{
      include: ReturnType<ChaptersService['chapterInclude']>;
    }>,
  ) {
    return {
      id: chapter.id,
      title: chapter.title,
      slug: chapter.slug,
      order: chapter.order,
      status: chapter.status,
      wordCount: chapter.wordCount,
      scheduledAt: chapter.scheduledAt,
      publishedAt: chapter.publishedAt,
      createdAt: chapter.createdAt,
      updatedAt: chapter.updatedAt,
    };
  }

  private toChapterDetailResponse(
    chapter: Prisma.ChapterGetPayload<{
      include: ReturnType<ChaptersService['chapterInclude']>;
    }>,
    publishedReader = false,
  ) {
    const publishedChapters =
      'chapters' in chapter.novel && Array.isArray(chapter.novel.chapters)
        ? chapter.novel.chapters
        : [];
    const currentIndex = publishedChapters.findIndex(
      (item) => item.id === chapter.id,
    );

    return {
      id: chapter.id,
      title: chapter.title,
      slug: chapter.slug,
      content: chapter.content,
      order: chapter.order,
      status: chapter.status,
      wordCount: chapter.wordCount,
      scheduledAt: chapter.scheduledAt,
      publishedAt: chapter.publishedAt,
      contentSnapshot: chapter.contentSnapshot,
      createdAt: chapter.createdAt,
      updatedAt: chapter.updatedAt,
      novel: {
        id: chapter.novel.id,
        title: chapter.novel.title,
        slug: chapter.novel.slug,
        author: {
          id: chapter.novel.author.id,
          username: chapter.novel.author.username,
          displayName:
            chapter.novel.author.profile?.displayName ??
            chapter.novel.author.username,
        },
      },
      navigation: publishedReader
        ? {
            previous:
              currentIndex > 0 ? publishedChapters[currentIndex - 1] : null,
            next:
              currentIndex >= 0 && currentIndex < publishedChapters.length - 1
                ? publishedChapters[currentIndex + 1]
                : null,
          }
        : null,
    };
  }
}
