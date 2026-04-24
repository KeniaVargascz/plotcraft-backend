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
}
