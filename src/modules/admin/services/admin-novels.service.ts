import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

interface NovelsQuery {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  rating?: string;
  authorId?: string;
  sort: string;
  order: 'asc' | 'desc';
}

@Injectable()
export class AdminNovelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
  ) {}

  async findAll(query: NovelsQuery) {
    const where: Prisma.NovelWhereInput = {};
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { author: { username: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    if (query.status) where.status = query.status as any;
    if (query.rating) where.rating = query.rating as any;
    if (query.authorId) where.authorId = query.authorId;

    const [data, total] = await Promise.all([
      this.prisma.novel.findMany({
        where,
        orderBy: { [query.sort]: query.order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          rating: true,
          isPublic: true,
          coverUrl: true,
          wordCount: true,
          viewsCount: true,
          kudosCount: true,
          createdAt: true,
          author: {
            select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true } } },
          },
          _count: { select: { chapters: true, subscriptions: true } },
        },
      }),
      this.prisma.novel.count({ where }),
    ]);

    return {
      data,
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit), hasMore: query.page * query.limit < total },
    };
  }

  async findOne(id: string) {
    const novel = await this.prisma.novel.findUnique({
      where: { id },
      select: {
        id: true, title: true, slug: true, synopsis: true, status: true, rating: true,
        isPublic: true, coverUrl: true, wordCount: true, viewsCount: true, kudosCount: true,
        novelType: true, tags: true, createdAt: true, updatedAt: true,
        author: { select: { id: true, username: true, email: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        _count: { select: { chapters: true, likes: true, bookmarks: true, subscriptions: true, novelComments: true } },
      },
    });
    if (!novel) throw new NotFoundException('Novela no encontrada');
    return novel;
  }

  async moderate(id: string, data: { status?: string; isPublic?: boolean }, admin: JwtPayload) {
    const novel = await this.prisma.novel.findUnique({ where: { id }, select: { id: true, title: true, status: true, isPublic: true } });
    if (!novel) throw new NotFoundException('Novela no encontrada');

    const updateData: any = {};
    if (data.status) updateData.status = data.status;
    if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;

    const updated = await this.prisma.novel.update({ where: { id }, data: updateData, select: { id: true, title: true, status: true, isPublic: true } });

    await this.auditService.log({
      adminId: admin.sub, adminEmail: admin.email,
      action: 'NOVEL_MODERATED', resourceType: 'novel', resourceId: id,
      details: { title: novel.title, changes: data, previous: { status: novel.status, isPublic: novel.isPublic } },
    });

    return updated;
  }

  async remove(id: string, admin: JwtPayload) {
    const novel = await this.prisma.novel.findUnique({ where: { id }, select: { id: true, title: true, authorId: true } });
    if (!novel) throw new NotFoundException('Novela no encontrada');

    await this.prisma.novel.delete({ where: { id } });

    await this.auditService.log({
      adminId: admin.sub, adminEmail: admin.email,
      action: 'NOVEL_DELETED', resourceType: 'novel', resourceId: id,
      details: { title: novel.title, authorId: novel.authorId },
    });

    return { deleted: true };
  }
}
