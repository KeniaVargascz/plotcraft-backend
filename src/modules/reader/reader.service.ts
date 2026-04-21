import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ReaderFontFamily, ReaderMode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NOVELS_SERVICE, INovelsService } from '../novels/novels.interface';
import { ReadingProgressBuffer } from './reading-progress-buffer.service';
import { ReaderPreferencesDto } from './dto/reader-preferences.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';

type CursorQuery = { cursor?: string; limit?: number };

@Injectable()
export class ReaderService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOVELS_SERVICE)
    private readonly novelsService: INovelsService,
    private readonly progressBuffer: ReadingProgressBuffer,
  ) {}

  async getPreferences(userId: string) {
    const preferences = await this.prisma.readerPreferences.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    return this.toPreferencesResponse(preferences);
  }

  async updatePreferences(userId: string, dto: ReaderPreferencesDto) {
    const preferences = await this.prisma.readerPreferences.upsert({
      where: { userId },
      update: {
        ...(dto.font_family
          ? { fontFamily: dto.font_family as ReaderFontFamily }
          : {}),
        ...(dto.font_size !== undefined ? { fontSize: dto.font_size } : {}),
        ...(dto.line_height !== undefined
          ? { lineHeight: dto.line_height }
          : {}),
        ...(dto.max_width !== undefined ? { maxWidth: dto.max_width } : {}),
        ...(dto.reading_mode
          ? { readingMode: dto.reading_mode as ReaderMode }
          : {}),
        ...(dto.show_progress !== undefined
          ? { showProgress: dto.show_progress }
          : {}),
      },
      create: {
        userId,
        ...(dto.font_family
          ? { fontFamily: dto.font_family as ReaderFontFamily }
          : {}),
        ...(dto.font_size !== undefined ? { fontSize: dto.font_size } : {}),
        ...(dto.line_height !== undefined
          ? { lineHeight: dto.line_height }
          : {}),
        ...(dto.max_width !== undefined ? { maxWidth: dto.max_width } : {}),
        ...(dto.reading_mode
          ? { readingMode: dto.reading_mode as ReaderMode }
          : {}),
        ...(dto.show_progress !== undefined
          ? { showProgress: dto.show_progress }
          : {}),
      },
    });

    return this.toPreferencesResponse(preferences);
  }

  async getProgress(userId: string, novelId: string) {
    const progress = await this.prisma.readingProgress.findUnique({
      where: {
        userId_novelId: {
          userId,
          novelId,
        },
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
    });

    if (!progress) {
      return null;
    }

    return this.toProgressResponse(progress);
  }

  async saveProgress(userId: string, dto: UpdateProgressDto) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: dto.chapter_id },
      select: {
        id: true,
        novelId: true,
        slug: true,
        title: true,
        order: true,
      },
    });

    if (!chapter || chapter.novelId !== dto.novel_id) {
      throw new BadRequestException(
        'El capitulo no pertenece a la novela indicada',
      );
    }

    await this.novelsService.findAccessibleNovelById(dto.novel_id, userId);

    // Buffer in Redis — flushed to DB every 15 seconds
    await this.progressBuffer.buffer({
      userId,
      novelId: dto.novel_id,
      chapterId: dto.chapter_id,
      scrollPct: dto.scroll_pct,
    });
    await this.progressBuffer.addPendingKey(userId, dto.novel_id);

    // Return immediately with the buffered values (no DB wait)
    return {
      novel_id: dto.novel_id,
      chapter_id: dto.chapter_id,
      scroll_pct: dto.scroll_pct,
      chapter: {
        slug: chapter.slug,
        title: chapter.title,
        order: chapter.order,
      },
      updated_at: new Date(),
    };
  }

  async createHistoryEntry(userId: string, novelId: string, chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { id: true, novelId: true },
    });

    if (!chapter || chapter.novelId !== novelId) {
      throw new BadRequestException(
        'El capitulo no pertenece a la novela indicada',
      );
    }

    await this.novelsService.findAccessibleNovelById(novelId, userId);

    const history = await this.prisma.readingHistory.create({
      data: {
        userId,
        novelId,
        chapterId,
      },
      include: {
        novel: {
          include: {
            author: {
              include: { profile: true },
            },
          },
        },
        chapter: true,
      },
    });

    return this.toHistoryItem(history);
  }

  async listHistory(userId: string, query: CursorQuery = {}) {
    const limit = Math.min(query.limit ?? 12, 50);
    const rows = await this.prisma.readingHistory.findMany({
      where: { userId },
      take: limit * 4 + 1,
      ...(query.cursor
        ? {
            skip: 1,
            cursor: { id: query.cursor },
          }
        : {}),
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
      include: {
        novel: {
          include: {
            author: {
              include: { profile: true },
            },
          },
        },
        chapter: true,
      },
    });

    const grouped = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!grouped.has(row.novelId)) {
        grouped.set(row.novelId, row);
      }

      if (grouped.size === limit) {
        break;
      }
    }

    const items = [...grouped.values()];
    return {
      data: items.map((item) => this.toHistoryItem(item)),
      pagination: {
        nextCursor:
          rows.length > items.length ? (rows.at(-1)?.id ?? null) : null,
        hasMore: rows.length > items.length,
        limit,
      },
    };
  }

  async listChronologicalHistory(userId: string, query: CursorQuery = {}) {
    const limit = Math.min(query.limit ?? 20, 50);
    const rows = await this.prisma.readingHistory.findMany({
      where: { userId },
      take: limit + 1,
      ...(query.cursor
        ? {
            skip: 1,
            cursor: { id: query.cursor },
          }
        : {}),
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
      include: {
        novel: {
          include: {
            author: {
              include: { profile: true },
            },
          },
        },
        chapter: true,
      },
    });
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    return {
      data: items.map((item) => this.toHistoryItem(item)),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  async getNovelProgressSummary(userId: string, novelId: string) {
    const progress = await this.prisma.readingProgress.findUnique({
      where: {
        userId_novelId: {
          userId,
          novelId,
        },
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
    });

    if (!progress) {
      return null;
    }

    return {
      chapter_id: progress.chapterId,
      chapter_slug: progress.chapter.slug,
      chapter_title: progress.chapter.title,
      chapter_order: progress.chapter.order,
      scroll_pct: progress.scrollPct,
      updated_at: progress.updatedAt,
    };
  }

  private toPreferencesResponse(preferences: {
    id: string;
    fontFamily: ReaderFontFamily;
    fontSize: number;
    lineHeight: number;
    maxWidth: number;
    readingMode: ReaderMode;
    showProgress: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: preferences.id,
      font_family: preferences.fontFamily,
      font_size: preferences.fontSize,
      line_height: preferences.lineHeight,
      max_width: preferences.maxWidth,
      reading_mode: preferences.readingMode,
      show_progress: preferences.showProgress,
      created_at: preferences.createdAt,
      updated_at: preferences.updatedAt,
    };
  }

  private toProgressResponse(progress: {
    novelId: string;
    chapterId: string;
    scrollPct: number;
    updatedAt: Date;
    chapter: {
      slug: string;
      title: string;
      order: number;
    };
  }) {
    return {
      novel_id: progress.novelId,
      chapter_id: progress.chapterId,
      scroll_pct: progress.scrollPct,
      chapter: {
        slug: progress.chapter.slug,
        title: progress.chapter.title,
        order: progress.chapter.order,
      },
      updated_at: progress.updatedAt,
    };
  }

  private toHistoryItem(history: {
    openedAt: Date;
    novel: {
      id: string;
      slug: string;
      title: string;
      coverUrl: string | null;
      author: {
        username: string;
        profile: {
          displayName: string | null;
        } | null;
      };
    };
    chapter: {
      id: string;
      slug: string;
      title: string;
      order: number;
    };
  }) {
    return {
      novel: {
        id: history.novel.id,
        slug: history.novel.slug,
        title: history.novel.title,
        cover_url: history.novel.coverUrl,
        author: {
          username: history.novel.author.username,
          display_name:
            history.novel.author.profile?.displayName ??
            history.novel.author.username,
        },
      },
      chapter: {
        id: history.chapter.id,
        slug: history.chapter.slug,
        title: history.chapter.title,
        order: history.chapter.order,
      },
      opened_at: history.openedAt,
    };
  }
}
