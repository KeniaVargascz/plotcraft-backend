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

    const prevStart = new Date(
      prevEnd.getTime() - days * 24 * 60 * 60 * 1000,
    );
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
    const pct = previous === 0 ? (current > 0 ? 100 : 0) : +((value / previous) * 100).toFixed(1);
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
      totalWords === 0 ? 0 : +((totalWords / 250)).toFixed(1);

    // Period delta
    let periodDelta = null;
    const prevRange = this.getPreviousPeriodRange(period);

    if (prevRange) {
      const [currentSnapshots, prevSnapshots] = await Promise.all([
        this.prisma.novelDailySnapshot.findMany({
          where: { novelId: novel.id, date: { gte: start, lte: end } },
        }),
        this.prisma.novelDailySnapshot.findMany({
          where: {
            novelId: novel.id,
            date: { gte: prevRange.start, lte: prevRange.end },
          },
        }),
      ]);

      const sumField = (
        snapshots: typeof currentSnapshots,
        field: 'views' | 'likes' | 'bookmarks' | 'newReaders' | 'chaptersRead' | 'wordsRead',
      ) => snapshots.reduce((acc, s) => acc + s[field], 0);

      const cur = {
        views: sumField(currentSnapshots, 'views'),
        likes: sumField(currentSnapshots, 'likes'),
        bookmarks: sumField(currentSnapshots, 'bookmarks'),
        newReaders: sumField(currentSnapshots, 'newReaders'),
        chaptersRead: sumField(currentSnapshots, 'chaptersRead'),
      };

      const prev = {
        views: sumField(prevSnapshots, 'views'),
        likes: sumField(prevSnapshots, 'likes'),
        bookmarks: sumField(prevSnapshots, 'bookmarks'),
        newReaders: sumField(prevSnapshots, 'newReaders'),
        chaptersRead: sumField(prevSnapshots, 'chaptersRead'),
      };

      periodDelta = {
        views: this.computeDelta(cur.views, prev.views),
        likes: this.computeDelta(cur.likes, prev.likes),
        bookmarks: this.computeDelta(cur.bookmarks, prev.bookmarks),
        newReaders: this.computeDelta(cur.newReaders, prev.newReaders),
        chaptersRead: this.computeDelta(cur.chaptersRead, prev.chaptersRead),
      };
    }

    // Chapter-level stats
    const chaptersWithStats = await Promise.all(
      chapters.map(async (ch) => {
        const [reads, uniqueReadsAgg, completedAgg] = await Promise.all([
          this.prisma.readingHistory.count({
            where: { chapterId: ch.id },
          }),
          this.prisma.readingHistory.findMany({
            where: { chapterId: ch.id },
            select: { userId: true },
            distinct: ['userId'],
          }),
          this.prisma.readingProgress.count({
            where: { chapterId: ch.id, scrollPct: { gte: 100 } },
          }),
        ]);

        const uniqueReads = uniqueReadsAgg.length;
        const chCompletionRate =
          uniqueReads === 0
            ? 0
            : +((completedAgg / uniqueReads) * 100).toFixed(1);
        const avgChReadTime =
          ch.wordCount === 0 ? 0 : +((ch.wordCount / 250)).toFixed(1);

        return {
          id: ch.id,
          title: ch.title,
          slug: ch.slug,
          order: ch.order,
          status: ch.status,
          publishedAt: ch.publishedAt,
          wordCount: ch.wordCount,
          stats: {
            reads,
            uniqueReads,
            completionRate: chCompletionRate,
            avgReadTimeMin: avgChReadTime,
          },
        };
      }),
    );

    return {
      novel: {
        id: novel.id,
        title: novel.title,
        slug: novel.slug,
        status: novel.status,
        createdAt: novel.createdAt,
      },
      totals: {
        views: novel.id
          ? (
              await this.prisma.novel.findUnique({
                where: { id: novel.id },
                select: { viewsCount: true },
              })
            )?.viewsCount ?? 0
          : 0,
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

    const topNovelsWithStats = await Promise.all(
      topNovels.map(async (n) => {
        const completedReaders = await this.prisma.readingProgress.count({
          where: { novelId: n.id, scrollPct: { gte: 100 } },
        });
        const readers = n._count.readingProgress;
        const completionRate =
          readers === 0
            ? 0
            : +((completedReaders / readers) * 100).toFixed(1);

        return {
          novel: { id: n.id, title: n.title, slug: n.slug },
          views: n.viewsCount,
          likes: n._count.likes,
          readers,
          completionRate,
        };
      }),
    );

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
        : +(((followers30d - followersPrev30d) / followersPrev30d) * 100).toFixed(1);

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

    const topGenresResult = topGenres.map((g) => {
      const genre = genreDetails.find((gd) => gd.id === g.genreId);
      return {
        genre: genre ?? { id: g.genreId, slug: '', label: '' },
        novelCount: g._count.genreId,
      };
    });

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
      const completionRates = await Promise.all(
        authorNovels.map(async (n) => {
          const [readers, completed] = await Promise.all([
            this.prisma.readingProgress.count({
              where: { novelId: n.id },
            }),
            this.prisma.readingProgress.count({
              where: { novelId: n.id, scrollPct: { gte: 100 } },
            }),
          ]);
          return readers === 0 ? 0 : (completed / readers) * 100;
        }),
      );
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
        avgLikesPerNovel: novelCount === 0 ? 0 : +(totalLikes / novelCount).toFixed(1),
        avgReadersPerNovel:
          novelCount === 0 ? 0 : +(totalReadersAll.length / novelCount).toFixed(1),
        avgCompletionRate,
      },
    };
  }
}
