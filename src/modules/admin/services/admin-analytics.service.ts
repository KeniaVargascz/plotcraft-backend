import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(days: number) {
    const now = new Date();
    const currentStart = new Date();
    currentStart.setDate(now.getDate() - days);
    const previousStart = new Date();
    previousStart.setDate(currentStart.getDate() - days);

    const [currentUsers, previousUsers, currentNovels, previousNovels,
           currentChapters, previousChapters, currentPosts, previousPosts] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: currentStart } } }),
      this.prisma.user.count({ where: { createdAt: { gte: previousStart, lt: currentStart } } }),
      this.prisma.novel.count({ where: { createdAt: { gte: currentStart } } }),
      this.prisma.novel.count({ where: { createdAt: { gte: previousStart, lt: currentStart } } }),
      this.prisma.chapter.count({ where: { publishedAt: { gte: currentStart }, status: 'PUBLISHED' } }),
      this.prisma.chapter.count({ where: { publishedAt: { gte: previousStart, lt: currentStart }, status: 'PUBLISHED' } }),
      this.prisma.post.count({ where: { createdAt: { gte: currentStart }, deletedAt: null } }),
      this.prisma.post.count({ where: { createdAt: { gte: previousStart, lt: currentStart }, deletedAt: null } }),
    ]);

    const delta = (current: number, previous: number) =>
      previous === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - previous) / previous) * 100);

    return {
      period: `${days}d`,
      metrics: {
        newUsers: { current: currentUsers, previous: previousUsers, delta: delta(currentUsers, previousUsers) },
        newNovels: { current: currentNovels, previous: previousNovels, delta: delta(currentNovels, previousNovels) },
        newChapters: { current: currentChapters, previous: previousChapters, delta: delta(currentChapters, previousChapters) },
        newPosts: { current: currentPosts, previous: previousPosts, delta: delta(currentPosts, previousPosts) },
      },
    };
  }

  async getTopNovels(limit: number, sort: string) {
    const orderBy: Record<string, string> = {};
    if (sort === 'kudosCount') orderBy.kudosCount = 'desc';
    else orderBy.viewsCount = 'desc';

    return this.prisma.novel.findMany({
      orderBy,
      take: limit,
      select: {
        id: true, title: true, slug: true, viewsCount: true, kudosCount: true, wordCount: true, status: true, coverUrl: true,
        author: { select: { username: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        _count: { select: { chapters: true, subscriptions: true } },
      },
    });
  }

  async getTopAuthors(limit: number) {
    const authors = await this.prisma.user.findMany({
      where: { novels: { some: {} } },
      orderBy: { followers: { _count: 'desc' } },
      take: limit,
      select: {
        id: true, username: true,
        profile: { select: { displayName: true, avatarUrl: true } },
        _count: { select: { novels: true, followers: true, posts: true } },
      },
    });
    return authors;
  }

  async getContentBreakdown() {
    const [novelsByStatus, novelsByRating, novelsByType, threadsByCategory] = await Promise.all([
      this.prisma.novel.groupBy({ by: ['status'], _count: true }),
      this.prisma.novel.groupBy({ by: ['rating'], _count: true }),
      this.prisma.novel.groupBy({ by: ['novelType'], _count: true }),
      this.prisma.forumThread.groupBy({ by: ['category'], where: { deletedAt: null }, _count: true }),
    ]);

    return {
      novelsByStatus: novelsByStatus.map(r => ({ status: r.status, count: r._count })),
      novelsByRating: novelsByRating.map(r => ({ rating: r.rating, count: r._count })),
      novelsByType: novelsByType.map(r => ({ type: r.novelType, count: r._count })),
      threadsByCategory: threadsByCategory.map(r => ({ category: r.category, count: r._count })),
    };
  }
}
