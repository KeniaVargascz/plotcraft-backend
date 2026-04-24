import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

interface PostsQuery {
  page: number;
  limit: number;
  type?: string;
  authorId?: string;
  search?: string;
}

@Injectable()
export class AdminPostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
  ) {}

  async findAll(query: PostsQuery) {
    const where: Prisma.PostWhereInput = { deletedAt: null };
    if (query.type) where.type = query.type as any;
    if (query.authorId) where.authorId = query.authorId;
    if (query.search) {
      where.content = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true, type: true, content: true, imageUrls: true, tags: true, createdAt: true,
          author: { select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true } } } },
          _count: { select: { comments: true, reactions: true } },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      data,
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit), hasMore: query.page * query.limit < total },
    };
  }

  async remove(id: string, admin: JwtPayload) {
    const post = await this.prisma.post.findUnique({ where: { id }, select: { id: true, authorId: true, type: true } });
    if (!post) throw new NotFoundException('Post no encontrado');

    await this.prisma.post.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.auditService.log({
      adminId: admin.sub, adminEmail: admin.email,
      action: 'POST_DELETED', resourceType: 'post', resourceId: id,
      details: { authorId: post.authorId, type: post.type },
    });

    return { deleted: true };
  }
}
