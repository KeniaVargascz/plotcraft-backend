import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReaderService } from '../reader/reader.service';
import { ReadingListsService } from '../reading-lists/reading-lists.service';
import { ReadingGoalDto } from './dto/reading-goal.dto';

type CursorQuery = { cursor?: string; limit?: number };

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readerService: ReaderService,
    private readonly readingListsService: ReadingListsService,
  ) {}

  async getLibrary(userId: string) {
    const [inProgress, completed, bookmarked, lists, goals] = await Promise.all(
      [
        this.listInProgress(userId, { limit: 4 }),
        this.listCompleted(userId, { limit: 4 }),
        this.listBookmarked(userId, { limit: 4 }),
        this.readingListsService.listMine(userId),
        this.listGoals(userId),
      ],
    );

    return {
      in_progress: inProgress.data,
      completed: completed.data,
      bookmarked: bookmarked.data,
      reading_lists: lists,
      active_goal:
        goals.find((goal) => this.isCurrentGoal(goal.year, goal.month)) ?? null,
    };
  }

  async listInProgress(userId: string, query: CursorQuery = {}) {
    return this.listProgressBucket(userId, query, 'IN_PROGRESS');
  }

  async listCompleted(userId: string, query: CursorQuery = {}) {
    return this.listProgressBucket(userId, query, 'COMPLETED');
  }

  async listBookmarked(userId: string, query: CursorQuery = {}) {
    const limit = Math.min(query.limit ?? 12, 50);
    const rows = await this.prisma.novelBookmark.findMany({
      where: { userId },
      take: limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        novel: {
          include: {
            author: { include: { profile: true } },
            chapters: {
              where: { status: 'PUBLISHED' },
              select: { id: true, slug: true, title: true, order: true },
            },
            likes: { select: { id: true } },
            bookmarks: { select: { id: true } },
          },
        },
      },
    });
    const hasMore = rows.length > limit;
    const items = rows
      .slice(0, limit)
      .map((row) => this.toNovelCard(row.novel, null));

    return {
      data: items,
      pagination: {
        nextCursor: hasMore ? (rows[limit - 1]?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  async listHistory(userId: string, query: CursorQuery = {}) {
    return this.readerService.listChronologicalHistory(userId, query);
  }

  async listGoals(userId: string) {
    const goals = await this.prisma.readingGoal.findMany({
      where: { userId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return Promise.all(
      goals.map((goal) =>
        this.toGoalResponse(userId, goal.year, goal.month, goal),
      ),
    );
  }

  async upsertGoal(userId: string, dto: ReadingGoalDto) {
    const existing = await this.prisma.readingGoal.findFirst({
      where: {
        userId,
        year: dto.year,
        month: dto.month ?? null,
      },
    });

    const goal = existing
      ? await this.prisma.readingGoal.update({
          where: { id: existing.id },
          data: {
            targetWords: dto.target_words,
          },
        })
      : await this.prisma.readingGoal.create({
          data: {
            userId,
            year: dto.year,
            month: dto.month ?? null,
            targetWords: dto.target_words,
          },
        });

    return this.toGoalResponse(userId, goal.year, goal.month, goal);
  }

  async getStats(userId: string) {
    const history = await this.prisma.readingHistory.findMany({
      where: { userId },
      orderBy: { openedAt: 'desc' },
      take: 5000,
      include: {
        chapter: {
          select: {
            id: true,
            wordCount: true,
          },
        },
        novel: {
          include: {
            genres: {
              include: {
                genre: true,
              },
            },
          },
        },
      },
    });

    const uniqueChapterIds = new Set(history.map((item) => item.chapterId));
    const uniqueNovelIds = new Set(history.map((item) => item.novelId));
    const completedNovelIds = new Set<string>();
    const wordsByMonth = new Map<
      string,
      { year: number; month: number; chapterIds: Set<string>; words: number }
    >();
    const genreFrequency = new Map<
      string,
      { slug: string; label: string; count: number }
    >();

    for (const item of history) {
      const key = `${item.openedAt.getUTCFullYear()}-${item.openedAt.getUTCMonth() + 1}`;
      if (!wordsByMonth.has(key)) {
        wordsByMonth.set(key, {
          year: item.openedAt.getUTCFullYear(),
          month: item.openedAt.getUTCMonth() + 1,
          chapterIds: new Set<string>(),
          words: 0,
        });
      }

      const bucket = wordsByMonth.get(key)!;
      if (!bucket.chapterIds.has(item.chapterId)) {
        bucket.chapterIds.add(item.chapterId);
        bucket.words += item.chapter.wordCount;
      }

      for (const genre of item.novel.genres) {
        const current = genreFrequency.get(genre.genre.slug) ?? {
          slug: genre.genre.slug,
          label: genre.genre.label,
          count: 0,
        };
        current.count += 1;
        genreFrequency.set(genre.genre.slug, current);
      }
    }

    const completedProgress = await this.prisma.readingProgress.findMany({
      where: { userId, scrollPct: { gte: 1 } },
      select: { novelId: true },
      distinct: ['novelId'],
    });

    for (const item of completedProgress) {
      completedNovelIds.add(item.novelId);
    }

    const chapterWordMap = new Map<string, number>();
    for (const item of history) {
      if (!chapterWordMap.has(item.chapterId)) {
        chapterWordMap.set(item.chapterId, item.chapter.wordCount);
      }
    }
    let totalWordsRead = 0;
    for (const words of chapterWordMap.values()) {
      totalWordsRead += words;
    }

    const favoriteGenre =
      [...genreFrequency.values()].sort((a, b) => b.count - a.count)[0] ?? null;

    const [totalBookmarks, totalHighlights] = await Promise.all([
      this.prisma.chapterBookmark.count({ where: { userId } }),
      this.prisma.highlight.count({ where: { userId } }),
    ]);

    return {
      total_chapters_read: uniqueChapterIds.size,
      total_novels_started: uniqueNovelIds.size,
      total_novels_completed: completedNovelIds.size,
      total_words_read: totalWordsRead,
      total_bookmarks: totalBookmarks,
      total_highlights: totalHighlights,
      reading_streak_days: this.calculateReadingStreak(
        history.map((item) => item.openedAt),
      ),
      favorite_genre: favoriteGenre
        ? { slug: favoriteGenre.slug, label: favoriteGenre.label }
        : null,
      monthly_breakdown: [...wordsByMonth.values()]
        .sort((a, b) =>
          a.year === b.year ? a.month - b.month : a.year - b.year,
        )
        .slice(-6)
        .map((item) => ({
          year: item.year,
          month: item.month,
          words_read: item.words,
          chapters_read: item.chapterIds.size,
        })),
    };
  }

  private async listProgressBucket(
    userId: string,
    query: CursorQuery,
    bucket: 'IN_PROGRESS' | 'COMPLETED',
  ) {
    const limit = Math.min(query.limit ?? 12, 50);
    const rows = await this.prisma.readingProgress.findMany({
      where: {
        userId,
      },
      take: limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      include: {
        chapter: {
          select: {
            id: true,
            slug: true,
            title: true,
            order: true,
          },
        },
        novel: {
          include: {
            author: { include: { profile: true } },
            chapters: {
              where: { status: 'PUBLISHED' },
              select: { id: true, slug: true, title: true, order: true },
            },
            likes: { select: { id: true } },
            bookmarks: { select: { id: true } },
          },
        },
      },
    });

    const filtered = rows.filter((row) =>
      bucket === 'COMPLETED'
        ? row.scrollPct >= 1
        : row.scrollPct > 0 && row.scrollPct < 1,
    );
    const items = filtered
      .slice(0, limit)
      .map((row) => this.toNovelCard(row.novel, row));

    return {
      data: items,
      pagination: {
        nextCursor: rows.length > limit ? (rows[limit - 1]?.id ?? null) : null,
        hasMore: rows.length > limit,
        limit,
      },
    };
  }

  private async toGoalResponse(
    userId: string,
    year: number,
    month: number | null,
    goal: { id: string; targetWords: number; createdAt: Date; updatedAt: Date },
  ) {
    const start = new Date(Date.UTC(year, (month ?? 1) - 1, 1, 0, 0, 0));
    const end = month
      ? new Date(Date.UTC(year, month, 1, 0, 0, 0))
      : new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));

    const history = await this.prisma.readingHistory.findMany({
      where: {
        userId,
        openedAt: {
          gte: start,
          lt: end,
        },
      },
      include: {
        chapter: {
          select: {
            id: true,
            wordCount: true,
          },
        },
      },
    });

    const uniqueChapters = new Map<string, number>();
    for (const item of history) {
      if (!uniqueChapters.has(item.chapterId)) {
        uniqueChapters.set(item.chapterId, item.chapter.wordCount);
      }
    }

    const uniqueNovelIds = new Set(history.map((item) => item.novelId));
    const wordsRead = [...uniqueChapters.values()].reduce(
      (sum, value) => sum + value,
      0,
    );

    return {
      id: goal.id,
      year,
      month,
      target_words: goal.targetWords,
      created_at: goal.createdAt,
      updated_at: goal.updatedAt,
      progress: {
        words_read: wordsRead,
        pct_complete: goal.targetWords
          ? Math.min(wordsRead / goal.targetWords, 1)
          : 0,
        novels_read: uniqueNovelIds.size,
        chapters_read: uniqueChapters.size,
      },
    };
  }

  private calculateReadingStreak(dates: Date[]) {
    const uniqueDates = new Set(
      dates.map((date) => date.toISOString().slice(0, 10)),
    );

    let streak = 0;
    const cursor = new Date();
    cursor.setUTCHours(0, 0, 0, 0);

    while (uniqueDates.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    return streak;
  }

  private isCurrentGoal(year: number, month: number | null) {
    const now = new Date();
    return month
      ? year === now.getUTCFullYear() && month === now.getUTCMonth() + 1
      : year === now.getUTCFullYear();
  }

  private toNovelCard(
    novel: {
      id: string;
      slug: string;
      title: string;
      coverUrl: string | null;
      status: string;
      wordCount: number;
      viewsCount: number;
      author: {
        username: string;
        profile: {
          displayName: string | null;
          avatarUrl: string | null;
        } | null;
      };
      chapters: Array<{
        id: string;
        slug: string;
        title: string;
        order: number;
      }>;
      likes: Array<{ id: string }>;
      bookmarks: Array<{ id: string }>;
    },
    progress: {
      chapter: {
        id: string;
        slug: string;
        title: string;
        order: number;
      };
      scrollPct: number;
      updatedAt: Date;
    } | null,
  ) {
    return {
      id: novel.id,
      slug: novel.slug,
      title: novel.title,
      cover_url: novel.coverUrl,
      status: novel.status,
      word_count: novel.wordCount,
      views_count: novel.viewsCount,
      author: {
        username: novel.author.username,
        display_name:
          novel.author.profile?.displayName ?? novel.author.username,
        avatar_url: novel.author.profile?.avatarUrl ?? null,
      },
      stats: {
        chapters_count: novel.chapters.length,
        likes_count: novel.likes.length,
        bookmarks_count: novel.bookmarks.length,
      },
      reading_progress: progress
        ? {
            chapter_id: progress.chapter.id,
            chapter_slug: progress.chapter.slug,
            chapter_title: progress.chapter.title,
            chapter_order: progress.chapter.order,
            scroll_pct: progress.scrollPct,
            updated_at: progress.updatedAt,
          }
        : null,
      last_chapter: novel.chapters.at(-1) ?? null,
    };
  }
}
