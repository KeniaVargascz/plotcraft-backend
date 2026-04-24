import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getGlobalStats() {
    const [users, novels, chapters, worlds, characters, communities, posts, forumThreads] =
      await Promise.all([
        this.prisma.user.count({ where: { isActive: true } }),
        this.prisma.novel.count(),
        this.prisma.chapter.count({ where: { status: 'PUBLISHED' } }),
        this.prisma.world.count(),
        this.prisma.character.count(),
        this.prisma.community.count({ where: { status: 'ACTIVE' } }),
        this.prisma.post.count({ where: { deletedAt: null } }),
        this.prisma.forumThread.count({ where: { deletedAt: null } }),
      ]);

    return { users, novels, chapters, worlds, characters, communities, posts, forumThreads };
  }

  async getRecentActivity(days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [newUsers, newNovels, newChapters, newPosts, newCommunities] =
      await Promise.all([
        this.prisma.user.count({ where: { createdAt: { gte: since } } }),
        this.prisma.novel.count({ where: { createdAt: { gte: since } } }),
        this.prisma.chapter.count({ where: { publishedAt: { gte: since }, status: 'PUBLISHED' } }),
        this.prisma.post.count({ where: { createdAt: { gte: since }, deletedAt: null } }),
        this.prisma.community.count({ where: { createdAt: { gte: since } } }),
      ]);

    return { period: `${days}d`, since: since.toISOString(), newUsers, newNovels, newChapters, newPosts, newCommunities };
  }

  async getGrowth(days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Aggregate by day
    const dailyMap = new Map<string, { users: number; novels: number; chapters: number; posts: number }>();

    for (let d = 0; d < days; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const key = date.toISOString().split('T')[0];
      dailyMap.set(key, { users: 0, novels: 0, chapters: 0, posts: 0 });
    }

    const [usersByDay, novelsByDay, chaptersByDay, postsByDay] = await Promise.all([
      this.prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE(created_at) as date, COUNT(*)::int as count
        FROM users WHERE created_at >= ${since}
        GROUP BY DATE(created_at) ORDER BY date`,
      this.prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE(created_at) as date, COUNT(*)::int as count
        FROM novels WHERE created_at >= ${since}
        GROUP BY DATE(created_at) ORDER BY date`,
      this.prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE(published_at) as date, COUNT(*)::int as count
        FROM chapters WHERE published_at >= ${since} AND status = 'PUBLISHED'
        GROUP BY DATE(published_at) ORDER BY date`,
      this.prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE(created_at) as date, COUNT(*)::int as count
        FROM posts WHERE created_at >= ${since} AND deleted_at IS NULL
        GROUP BY DATE(created_at) ORDER BY date`,
    ]);

    for (const row of usersByDay) {
      const key = new Date(row.date).toISOString().split('T')[0];
      const entry = dailyMap.get(key);
      if (entry) entry.users = Number(row.count);
    }
    for (const row of novelsByDay) {
      const key = new Date(row.date).toISOString().split('T')[0];
      const entry = dailyMap.get(key);
      if (entry) entry.novels = Number(row.count);
    }
    for (const row of chaptersByDay) {
      const key = new Date(row.date).toISOString().split('T')[0];
      const entry = dailyMap.get(key);
      if (entry) entry.chapters = Number(row.count);
    }
    for (const row of postsByDay) {
      const key = new Date(row.date).toISOString().split('T')[0];
      const entry = dailyMap.get(key);
      if (entry) entry.posts = Number(row.count);
    }

    const series = Array.from(dailyMap.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return series;
  }
}
