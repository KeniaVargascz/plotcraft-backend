import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SnapshotService } from './snapshot.service';

type Period = '7d' | '30d' | '90d' | '1y' | 'all';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotService: SnapshotService,
  ) {}

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  private getPeriodDays(period: Period): number | null {
    const map: Record<Period, number | null> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
      all: null,
    };
    return map[period];
  }

  private getPeriodRange(period: Period): { start: Date; end: Date } {
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const days = this.getPeriodDays(period);
    const start = days
      ? new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
      : new Date(0);
    start.setHours(0, 0, 0, 0);

    return { start, end };
  }

  private getPreviousPeriodRange(period: Period): {
    start: Date;
    end: Date;
  } | null {
    const days = this.getPeriodDays(period);
    if (!days) return null;

    const currentEnd = new Date();
    currentEnd.setHours(23, 59, 59, 999);

    const currentStart = new Date(
      currentEnd.getTime() - days * 24 * 60 * 60 * 1000,
    );
    currentStart.setHours(0, 0, 0, 0);

    const prevEnd = new Date(currentStart.getTime() - 1);
    prevEnd.setHours(23, 59, 59, 999);

    const prevStart = new Date(prevEnd.getTime() - days * 24 * 60 * 60 * 1000);
    prevStart.setHours(0, 0, 0, 0);

    return { start: prevStart, end: prevEnd };
  }

  private async verifyNovelOwnership(slug: string, userId: string) {
    const novel = await this.prisma.novel.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        createdAt: true,
        authorId: true,
        viewsCount: true,
      },
    });

    if (!novel) throw new NotFoundException('Novel not found');
    if (novel.authorId !== userId)
      throw new ForbiddenException('Not your novel');

    return novel;
  }

  private computeDelta(
    current: number,
    previous: number,
  ): { value: number; pct: number } {
    const value = current - previous;
    const pct =
      previous === 0
        ? current > 0
          ? 100
          : 0
        : +((value / previous) * 100).toFixed(1);
    return { value, pct };
  }

  /* ------------------------------------------------------------------ */
  /*  Novel Analytics                                                    */
  /* ------------------------------------------------------------------ */

  async getNovelAnalytics(slug: string, userId: string, period: Period) {
    const novel = await this.verifyNovelOwnership(slug, userId);
    const today = new Date();

    await this.snapshotService.ensureNovelSnapshot(novel.id, today);

    const { start, end } = this.getPeriodRange(period);

    // Totals
    const [
      totalLikes,
      totalBookmarks,
      totalReadersAgg,
      completedReadersCount,
      totalWordsAgg,
      chapters,
    ] = await Promise.all([
      this.prisma.novelLike.count({ where: { novelId: novel.id } }),
      this.prisma.novelBookmark.count({ where: { novelId: novel.id } }),
      this.prisma.readingProgress.findMany({
        where: { novelId: novel.id },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.readingProgress.count({
        where: { novelId: novel.id, scrollPct: { gte: 100 } },
      }),
      this.prisma.chapter.aggregate({
        where: { novelId: novel.id, status: 'PUBLISHED' },
        _sum: { wordCount: true },
      }),
      this.prisma.chapter.findMany({
        where: { novelId: novel.id },
        select: {
          id: true,
          title: true,
          slug: true,
          order: true,
          status: true,
          publishedAt: true,
          wordCount: true,
        },
        orderBy: { order: 'asc' },
      }),
    ]);

    const totalReaders = totalReadersAgg.length;
    const totalWords = totalWordsAgg._sum.wordCount ?? 0;
    const completionRate =
      totalReaders === 0
        ? 0
        : +((completedReadersCount / totalReaders) * 100).toFixed(1);
    const avgReadTimeMin =
      totalWords === 0 ? 0 : +(totalWords / 250).toFixed(1);

    // Period delta
    let periodDelta = null;
    const prevRange = this.getPreviousPeriodRange(period);

    if (prevRange) {
      const sumFields = {
        views: true,
        likes: true,
        bookmarks: true,
        newReaders: true,
        chaptersRead: true,
      } as const;

      const [curAgg, prevAgg] = await Promise.all([
        this.prisma.novelDailySnapshot.aggregate({
          where: { novelId: novel.id, date: { gte: start, lte: end } },
          _sum: sumFields,
        }),
        this.prisma.novelDailySnapshot.aggregate({
          where: { novelId: novel.id, date: { gte: prevRange.start, lte: prevRange.end } },
          _sum: sumFields,
        }),
      ]);

      const cur = curAgg._sum;
      const prev = prevAgg._sum;

      periodDelta = {
        views: this.computeDelta(cur.views ?? 0, prev.views ?? 0),
        likes: this.computeDelta(cur.likes ?? 0, prev.likes ?? 0),
        bookmarks: this.computeDelta(cur.bookmarks ?? 0, prev.bookmarks ?? 0),
        newReaders: this.computeDelta(cur.newReaders ?? 0, prev.newReaders ?? 0),
        chaptersRead: this.computeDelta(cur.chaptersRead ?? 0, prev.chaptersRead ?? 0),
      };
    }

    // Chapter-level stats
    const chapterIds = chapters.map((chapter) => chapter.id);
    const [chapterReadCounts, chapterReaderPairs, chapterCompletedCounts] =
      await Promise.all([
        this.prisma.readingHistory.groupBy({
          by: ['chapterId'],
          where: { chapterId: { in: chapterIds } },
          _count: { _all: true },
        }),
        this.prisma.readingHistory.findMany({
          where: { chapterId: { in: chapterIds } },
          select: { chapterId: true, userId: true },
          distinct: ['chapterId', 'userId'],
        }),
        this.prisma.readingProgress.groupBy({
          by: ['chapterId'],
          where: { chapterId: { in: chapterIds }, scrollPct: { gte: 100 } },
          _count: { _all: true },
        }),
      ]);

    const readsByChapterId = new Map(
      chapterReadCounts.map((item) => [item.chapterId, item._count._all]),
    );
    const completedByChapterId = new Map(
      chapterCompletedCounts
        .filter(
          (
            item,
          ): item is typeof item & {
            chapterId: string;
          } => item.chapterId !== null,
        )
        .map((item) => [item.chapterId, item._count._all]),
    );
    const uniqueReadersByChapterId = new Map<string, number>();

    for (const pair of chapterReaderPairs) {
      const current = uniqueReadersByChapterId.get(pair.chapterId) ?? 0;
      uniqueReadersByChapterId.set(pair.chapterId, current + 1);
    }

    const chaptersWithStats = chapters.map((chapter) => {
      const reads = readsByChapterId.get(chapter.id) ?? 0;
      const uniqueReads = uniqueReadersByChapterId.get(chapter.id) ?? 0;
      const completed = completedByChapterId.get(chapter.id) ?? 0;
      const chCompletionRate =
        uniqueReads === 0 ? 0 : +((completed / uniqueReads) * 100).toFixed(1);
      const avgChReadTime =
        chapter.wordCount === 0 ? 0 : +(chapter.wordCount / 250).toFixed(1);

      return {
        id: chapter.id,
        title: chapter.title,
        slug: chapter.slug,
        order: chapter.order,
        status: chapter.status,
        publishedAt: chapter.publishedAt,
        wordCount: chapter.wordCount,
        stats: {
          reads,
          uniqueReads,
          completionRate: chCompletionRate,
          avgReadTimeMin: avgChReadTime,
        },
      };
    });

    return {
      novel: {
        id: novel.id,
        title: novel.title,
        slug: novel.slug,
        status: novel.status,
        createdAt: novel.createdAt,
      },
      totals: {
        views: novel.viewsCount ?? 0,
        likes: totalLikes,
        bookmarks: totalBookmarks,
        totalReaders,
        completedReaders: completedReadersCount,
        completionRate,
        totalWords,
        avgReadTimeMin,
      },
      periodDelta,
      chapters: chaptersWithStats,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Novel Timeline                                                     */
  /* ------------------------------------------------------------------ */

  async getNovelTimeline(slug: string, userId: string, period: Period) {
    const novel = await this.verifyNovelOwnership(slug, userId);
    const { start, end } = this.getPeriodRange(period);

    const snapshots = await this.prisma.novelDailySnapshot.findMany({
      where: {
        novelId: novel.id,
        date: { gte: start, lte: end },
      },
      orderBy: { date: 'asc' },
    });

    return { novelId: novel.id, period, snapshots };
  }

  /* ------------------------------------------------------------------ */
  /*  Author Analytics                                                   */
  /* ------------------------------------------------------------------ */

  async getAuthorAnalytics(userId: string, period: Period) {
    void period;
    const today = new Date();
    await this.snapshotService.ensureAuthorSnapshot(userId, today);

    const [
      totalNovels,
      publishedNovels,
      totalChapters,
      publishedChapters,
      totalWordsAgg,
      totalViewsAgg,
      totalLikes,
      totalBookmarks,
      totalReadersAgg,
      totalFollowers,
      totalPosts,
      totalPostReactions,
    ] = await Promise.all([
      this.prisma.novel.count({ where: { authorId: userId } }),
      this.prisma.novel.count({
        where: { authorId: userId, status: 'IN_PROGRESS' },
      }),
      this.prisma.chapter.count({ where: { authorId: userId } }),
      this.prisma.chapter.count({
        where: { authorId: userId, status: 'PUBLISHED' },
      }),
      this.prisma.chapter.aggregate({
        where: { authorId: userId, status: 'PUBLISHED' },
        _sum: { wordCount: true },
      }),
      this.prisma.novel.aggregate({
        where: { authorId: userId },
        _sum: { viewsCount: true },
      }),
      this.prisma.novelLike.count({
        where: { novel: { authorId: userId } },
      }),
      this.prisma.novelBookmark.count({
        where: { novel: { authorId: userId } },
      }),
      this.prisma.readingProgress.findMany({
        where: { novel: { authorId: userId } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.follow.count({ where: { followingId: userId } }),
      this.prisma.post.count({ where: { authorId: userId } }),
      this.prisma.reaction.count({
        where: { post: { authorId: userId } },
      }),
    ]);

    // Top 5 novels by views
    const topNovels = await this.prisma.novel.findMany({
      where: { authorId: userId },
      orderBy: { viewsCount: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        slug: true,
        viewsCount: true,
        _count: { select: { likes: true, readingProgress: true } },
      },
    });

    const completedReadersByNovel = new Map(
      (
        await this.prisma.readingProgress.groupBy({
          by: ['novelId'],
          where: {
            novelId: { in: topNovels.map((novelItem) => novelItem.id) },
            scrollPct: { gte: 100 },
          },
          _count: { _all: true },
        })
      ).map((item) => [item.novelId, item._count._all]),
    );

    const topNovelsWithStats = topNovels.map((novelItem) => {
      const readers = novelItem._count.readingProgress;
      const completedReaders = completedReadersByNovel.get(novelItem.id) ?? 0;
      const completionRate =
        readers === 0 ? 0 : +((completedReaders / readers) * 100).toFixed(1);

      return {
        novel: {
          id: novelItem.id,
          title: novelItem.title,
          slug: novelItem.slug,
        },
        views: novelItem.viewsCount,
        likes: novelItem._count.likes,
        readers,
        completionRate,
      };
    });

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [newFollowers7d, newLikes7d, newReaders7d, chaptersPublished7d] =
      await Promise.all([
        this.prisma.follow.count({
          where: {
            followingId: userId,
            createdAt: { gte: sevenDaysAgo },
          },
        }),
        this.prisma.novelLike.count({
          where: {
            novel: { authorId: userId },
            createdAt: { gte: sevenDaysAgo },
          },
        }),
        this.prisma.readingHistory.findMany({
          where: {
            novel: { authorId: userId },
            openedAt: { gte: sevenDaysAgo },
          },
          select: { userId: true },
          distinct: ['userId'],
        }),
        this.prisma.chapter.count({
          where: {
            authorId: userId,
            status: 'PUBLISHED',
            publishedAt: { gte: sevenDaysAgo },
          },
        }),
      ]);

    return {
      totals: {
        totalNovels,
        publishedNovels,
        totalChapters,
        publishedChapters,
        totalWordsPublished: totalWordsAgg._sum.wordCount ?? 0,
        totalViews: totalViewsAgg._sum.viewsCount ?? 0,
        totalLikes,
        totalBookmarks,
        totalReadersUnique: totalReadersAgg.length,
        totalFollowers,
        totalPosts,
        totalPostReactions,
      },
      topNovels: topNovelsWithStats,
      recentActivity: {
        newFollowers: newFollowers7d,
        newLikes: newLikes7d,
        newReaders: newReaders7d.length,
        chaptersPublished: chaptersPublished7d,
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Author Timeline                                                    */
  /* ------------------------------------------------------------------ */

  async getAuthorTimeline(userId: string, period: Period) {
    const { start, end } = this.getPeriodRange(period);

    const snapshots = await this.prisma.authorDailySnapshot.findMany({
      where: {
        authorId: userId,
        date: { gte: start, lte: end },
      },
      orderBy: { date: 'asc' },
    });

    return { authorId: userId, period, snapshots };
  }

  /* ------------------------------------------------------------------ */
  /*  Audience                                                           */
  /* ------------------------------------------------------------------ */

  async getAudience(userId: string) {
    const totalFollowers = await this.prisma.follow.count({
      where: { followingId: userId },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    sixtyDaysAgo.setHours(0, 0, 0, 0);

    const [followers30d, followersPrev30d] = await Promise.all([
      this.prisma.follow.count({
        where: {
          followingId: userId,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.follow.count({
        where: {
          followingId: userId,
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        },
      }),
    ]);

    const growthPct =
      followersPrev30d === 0
        ? followers30d > 0
          ? 100
          : 0
        : +(
            ((followers30d - followersPrev30d) / followersPrev30d) *
            100
          ).toFixed(1);

    // Readers
    const totalUniqueReaders = await this.prisma.readingProgress.findMany({
      where: { novel: { authorId: userId } },
      select: { userId: true },
      distinct: ['userId'],
    });

    // Returning readers: users who read more than one novel
    const readerNovelCounts = await this.prisma.readingProgress.groupBy({
      by: ['userId'],
      where: { novel: { authorId: userId } },
      _count: { novelId: true },
    });

    const returningReaders = readerNovelCounts.filter(
      (r) => r._count.novelId > 1,
    ).length;

    const totalUnique = totalUniqueReaders.length;
    const retentionRate =
      totalUnique === 0
        ? 0
        : +((returningReaders / totalUnique) * 100).toFixed(1);

    // Top genres across author's novels
    const topGenres = await this.prisma.novelGenre.groupBy({
      by: ['genreId'],
      where: { novel: { authorId: userId } },
      _count: { genreId: true },
      orderBy: { _count: { genreId: 'desc' } },
      take: 5,
    });

    const genreDetails = await this.prisma.genre.findMany({
      where: { id: { in: topGenres.map((g) => g.genreId) } },
      select: { id: true, slug: true, label: true },
    });

    const genreMap = new Map(genreDetails.map((gd) => [gd.id, gd]));
    const topGenresResult = topGenres.map((g) => ({
      genre: genreMap.get(g.genreId) ?? { id: g.genreId, slug: '', label: '' },
      novelCount: g._count.genreId,
    }));

    // Engagement
    const authorNovels = await this.prisma.novel.findMany({
      where: { authorId: userId },
      select: { id: true },
    });

    const novelCount = authorNovels.length;

    const [totalLikes, totalReadersAll] = await Promise.all([
      this.prisma.novelLike.count({
        where: { novel: { authorId: userId } },
      }),
      this.prisma.readingProgress.findMany({
        where: { novel: { authorId: userId } },
        select: { userId: true, novelId: true },
        distinct: ['userId', 'novelId'],
      }),
    ]);

    // Avg completion rate across novels
    let avgCompletionRate = 0;
    if (novelCount > 0) {
      const [readerCountsByNovel, completedCountsByNovel] = await Promise.all([
        this.prisma.readingProgress.groupBy({
          by: ['novelId'],
          where: {
            novelId: { in: authorNovels.map((novelItem) => novelItem.id) },
          },
          _count: { _all: true },
        }),
        this.prisma.readingProgress.groupBy({
          by: ['novelId'],
          where: {
            novelId: { in: authorNovels.map((novelItem) => novelItem.id) },
            scrollPct: { gte: 100 },
          },
          _count: { _all: true },
        }),
      ]);
      const readersByNovelId = new Map(
        readerCountsByNovel.map((item) => [item.novelId, item._count._all]),
      );
      const completedByNovelId = new Map(
        completedCountsByNovel.map((item) => [item.novelId, item._count._all]),
      );
      const completionRates = authorNovels.map((novelItem) => {
        const readers = readersByNovelId.get(novelItem.id) ?? 0;
        const completed = completedByNovelId.get(novelItem.id) ?? 0;
        return readers === 0 ? 0 : (completed / readers) * 100;
      });
      avgCompletionRate = +(
        completionRates.reduce((a, b) => a + b, 0) / novelCount
      ).toFixed(1);
    }

    return {
      followers: {
        total: totalFollowers,
        growth30d: followers30d,
        growthPct,
      },
      readers: {
        totalUnique,
        returning: returningReaders,
        retentionRate,
      },
      topGenres: topGenresResult,
      engagement: {
        avgLikesPerNovel:
          novelCount === 0 ? 0 : +(totalLikes / novelCount).toFixed(1),
        avgReadersPerNovel:
          novelCount === 0
            ? 0
            : +(totalReadersAll.length / novelCount).toFixed(1),
        avgCompletionRate,
      },
    };
  }
}
