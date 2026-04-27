import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

interface CommunitiesQuery {
  page: number;
  limit: number;
  status?: string;
  type?: string;
  search?: string;
}

@Injectable()
export class AdminCommunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
  ) {}

  async findAll(query: CommunitiesQuery) {
    const where: Prisma.CommunityWhereInput = {};
    if (query.status) where.status = query.status as any;
    if (query.type) where.type = query.type as any;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.community.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          type: true,
          status: true,
          coverUrl: true,
          membersCount: true,
          followersCount: true,
          createdAt: true,
          owner: {
            select: {
              id: true,
              username: true,
              profile: { select: { displayName: true, avatarUrl: true } },
            },
          },
        },
      }),
      this.prisma.community.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
        hasMore: query.page * query.limit < total,
      },
    };
  }

  async pendingCount() {
    const count = await this.prisma.community.count({ where: { status: 'PENDING' } });
    return { count };
  }

  async approve(id: string, admin: JwtPayload) {
    const community = await this.prisma.community.findUnique({ where: { id }, select: { id: true, name: true, status: true } });
    if (!community) throw new NotFoundException({ statusCode: 404, message: 'Community not found', code: 'COMMUNITY_NOT_FOUND' });
    if (community.status !== 'PENDING') throw new BadRequestException({ statusCode: 400, message: 'Only pending communities can be approved', code: 'COMMUNITY_NOT_PENDING' });

    const updated = await this.prisma.community.update({
      where: { id },
      data: { status: 'ACTIVE' },
      select: { id: true, name: true, slug: true, status: true },
    });

    await this.auditService.log({
      adminId: admin.sub,
      adminEmail: admin.email,
      action: 'COMMUNITY_APPROVED',
      resourceType: 'community',
      resourceId: id,
      details: { communityName: community.name },
    });

    return updated;
  }

  async reject(id: string, reason: string, admin: JwtPayload) {
    const community = await this.prisma.community.findUnique({ where: { id }, select: { id: true, name: true, status: true } });
    if (!community) throw new NotFoundException({ statusCode: 404, message: 'Community not found', code: 'COMMUNITY_NOT_FOUND' });
    if (community.status !== 'PENDING') throw new BadRequestException({ statusCode: 400, message: 'Only pending communities can be rejected', code: 'COMMUNITY_NOT_PENDING' });

    const updated = await this.prisma.community.update({
      where: { id },
      data: { status: 'REJECTED', rejectionReason: reason },
      select: { id: true, name: true, slug: true, status: true },
    });

    await this.auditService.log({
      adminId: admin.sub,
      adminEmail: admin.email,
      action: 'COMMUNITY_REJECTED',
      resourceType: 'community',
      resourceId: id,
      details: { communityName: community.name, reason },
    });

    return updated;
  }

  async suspend(id: string, admin: JwtPayload) {
    const community = await this.prisma.community.findUnique({ where: { id }, select: { id: true, name: true, status: true } });
    if (!community) throw new NotFoundException({ statusCode: 404, message: 'Community not found', code: 'COMMUNITY_NOT_FOUND' });

    const updated = await this.prisma.community.update({
      where: { id },
      data: { status: 'SUSPENDED' },
      select: { id: true, name: true, slug: true, status: true },
    });

    await this.auditService.log({
      adminId: admin.sub,
      adminEmail: admin.email,
      action: 'COMMUNITY_SUSPENDED',
      resourceType: 'community',
      resourceId: id,
      details: { communityName: community.name },
    });

    return updated;
  }

  async activate(id: string, admin: JwtPayload) {
    const community = await this.prisma.community.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!community) throw new NotFoundException({ statusCode: 404, message: 'Community not found', code: 'COMMUNITY_NOT_FOUND' });

    const updated = await this.prisma.community.update({
      where: { id },
      data: { status: 'ACTIVE' },
      select: { id: true, name: true, slug: true, status: true },
    });

    await this.auditService.log({
      adminId: admin.sub,
      adminEmail: admin.email,
      action: 'COMMUNITY_ACTIVATED',
      resourceType: 'community',
      resourceId: id,
      details: { communityName: community.name },
    });

    return updated;
  }
}
