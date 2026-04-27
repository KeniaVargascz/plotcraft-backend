import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

interface ThreadsQuery {
  page: number;
  limit: number;
  category?: string;
  status?: string;
  search?: string;
}

@Injectable()
export class AdminForumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
  ) {}

  async findAllThreads(query: ThreadsQuery) {
    const where: Prisma.ForumThreadWhereInput = { deletedAt: null };
    if (query.category) where.category = query.category as any;
    if (query.status) where.status = query.status as any;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { content: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.forumThread.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true, title: true, slug: true, category: true, status: true,
          isPinned: true, viewsCount: true, repliesCount: true, reactionsCount: true,
          createdAt: true,
          author: { select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        },
      }),
      this.prisma.forumThread.count({ where }),
    ]);

    return {
      data,
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit), hasMore: query.page * query.limit < total },
    };
  }

  async togglePin(id: string, admin: JwtPayload) {
    const thread = await this.prisma.forumThread.findUnique({ where: { id }, select: { id: true, title: true, isPinned: true } });
    if (!thread) throw new NotFoundException({ statusCode: 404, message: 'Thread not found', code: 'THREAD_NOT_FOUND' });

    const updated = await this.prisma.forumThread.update({ where: { id }, data: { isPinned: !thread.isPinned }, select: { id: true, title: true, isPinned: true } });

    await this.auditService.log({
      adminId: admin.sub, adminEmail: admin.email,
      action: updated.isPinned ? 'THREAD_PINNED' : 'THREAD_UNPINNED',
      resourceType: 'forum_thread', resourceId: id,
      details: { title: thread.title },
    });

    return updated;
  }

  async close(id: string, admin: JwtPayload) {
    const thread = await this.prisma.forumThread.findUnique({ where: { id }, select: { id: true, title: true } });
    if (!thread) throw new NotFoundException({ statusCode: 404, message: 'Thread not found', code: 'THREAD_NOT_FOUND' });

    const updated = await this.prisma.forumThread.update({ where: { id }, data: { status: 'CLOSED' }, select: { id: true, title: true, status: true } });

    await this.auditService.log({
      adminId: admin.sub, adminEmail: admin.email,
      action: 'THREAD_CLOSED', resourceType: 'forum_thread', resourceId: id,
      details: { title: thread.title },
    });

    return updated;
  }

  async removeThread(id: string, admin: JwtPayload) {
    const thread = await this.prisma.forumThread.findUnique({ where: { id }, select: { id: true, title: true } });
    if (!thread) throw new NotFoundException({ statusCode: 404, message: 'Thread not found', code: 'THREAD_NOT_FOUND' });

    await this.prisma.forumThread.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.auditService.log({
      adminId: admin.sub, adminEmail: admin.email,
      action: 'THREAD_DELETED', resourceType: 'forum_thread', resourceId: id,
      details: { title: thread.title },
    });

    return { deleted: true };
  }

  async removeReply(id: string, admin: JwtPayload) {
    const reply = await this.prisma.forumReply.findUnique({ where: { id }, select: { id: true, threadId: true } });
    if (!reply) throw new NotFoundException({ statusCode: 404, message: 'Reply not found', code: 'REPLY_NOT_FOUND' });

    await this.prisma.forumReply.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.auditService.log({
      adminId: admin.sub, adminEmail: admin.email,
      action: 'REPLY_DELETED', resourceType: 'forum_reply', resourceId: id,
      details: { threadId: reply.threadId },
    });

    return { deleted: true };
  }
}
