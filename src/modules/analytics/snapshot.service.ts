import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ensureNovelSnapshot(novelId: string, date: Date): Promise<void> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    try {
      const existing = await this.prisma.novelDailySnapshot.findUnique({
        where: { novelId_date: { novelId, date: dayStart } },
      });

      if (existing) return;

      const novel = await this.prisma.novel.findUnique({
        where: { id: novelId },
        select: { viewsCount: true },
      });

      const [likes, bookmarks, chaptersRead] = await Promise.all([
        this.prisma.novelLike.count({
          where: {
            novelId,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        }),
        this.prisma.novelBookmark.count({
          where: {
            novelId,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        }),
        this.prisma.readingHistory.count({
          where: {
            novelId,
            openedAt: { gte: dayStart, lte: dayEnd },
          },
        }),
      ]);

      // New readers: users who read on this day but never before
      const allReadersToday = await this.prisma.readingHistory.findMany({
        where: {
          novelId,
          openedAt: { gte: dayStart, lte: dayEnd },
        },
        select: { userId: true },
        distinct: ['userId'],
      });

      let newReaders = 0;
      if (allReadersToday.length > 0) {
        const todayUserIds = allReadersToday.map((r) => r.userId);
        const returningReaders = await this.prisma.readingHistory.findMany({
          where: {
            novelId,
            userId: { in: todayUserIds },
            openedAt: { lt: dayStart },
          },
          select: { userId: true },
          distinct: ['userId'],
        });
        const returningSet = new Set(returningReaders.map((r) => r.userId));
        newReaders = todayUserIds.filter((id) => !returningSet.has(id)).length;
      }

      // Words read: sum wordCount for chapters read that day
      const chaptersReadToday = await this.prisma.readingHistory.findMany({
        where: {
          novelId,
          openedAt: { gte: dayStart, lte: dayEnd },
        },
        select: { chapterId: true },
        distinct: ['chapterId'],
      });

      let wordsRead = 0;
      if (chaptersReadToday.length > 0) {
        const agg = await this.prisma.chapter.aggregate({
          where: {
            id: { in: chaptersReadToday.map((c) => c.chapterId) },
          },
          _sum: { wordCount: true },
        });
        wordsRead = agg._sum.wordCount ?? 0;
      }

      await this.prisma.novelDailySnapshot.create({
        data: {
          novelId,
          date: dayStart,
          views: novel?.viewsCount ?? 0,
          likes,
          bookmarks,
          newReaders,
          chaptersRead,
          wordsRead,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to create novel snapshot for ${novelId}: ${error}`,
      );
    }
  }

  async ensureAuthorSnapshot(authorId: string, date: Date): Promise<void> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    try {
      const existing = await this.prisma.authorDailySnapshot.findUnique({
        where: { authorId_date: { authorId, date: dayStart } },
      });

      if (existing) return;

      const [newFollowers, postReactions] = await Promise.all([
        this.prisma.follow.count({
          where: {
            followingId: authorId,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        }),
        this.prisma.reaction.count({
          where: {
            post: { authorId },
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        }),
      ]);

      await this.prisma.authorDailySnapshot.create({
        data: {
          authorId,
          date: dayStart,
          newFollowers,
          postReactions,
          profileViews: 0,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to create author snapshot for ${authorId}: ${error}`,
      );
    }
  }
}
