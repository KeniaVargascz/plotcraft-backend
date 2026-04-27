import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

interface UsersQuery {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  isAdmin?: boolean;
  sort: string;
  order: 'asc' | 'desc';
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
  ) {}

  async findAll(query: UsersQuery) {
    const where: Prisma.UserWhereInput = {};

    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { username: { contains: query.search, mode: 'insensitive' } },
        { nickname: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.status) {
      where.status = query.status as any;
    }
    if (query.isAdmin !== undefined) {
      where.isAdmin = query.isAdmin;
    }

    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [query.sort]: query.order,
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          email: true,
          username: true,
          nickname: true,
          status: true,
          isActive: true,
          isAdmin: true,
          createdAt: true,
          updatedAt: true,
          profile: {
            select: {
              displayName: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              novels: true,
              posts: true,
              followers: true,
              following: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
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

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        nickname: true,
        status: true,
        isActive: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        profile: {
          select: {
            displayName: true,
            bio: true,
            avatarUrl: true,
            bannerUrl: true,
            website: true,
            isPublic: true,
          },
        },
        _count: {
          select: {
            novels: true,
            chapters: true,
            posts: true,
            comments: true,
            followers: true,
            following: true,
            worlds: true,
            characters: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException({ statusCode: 404, message: 'User not found', code: 'USER_NOT_FOUND' });
    return user;
  }

  async updateStatus(id: string, dto: UpdateUserStatusDto, admin: JwtPayload) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true, isAdmin: true } });
    if (!user) throw new NotFoundException({ statusCode: 404, message: 'User not found', code: 'USER_NOT_FOUND' });
    if (user.isAdmin) throw new BadRequestException({ statusCode: 400, message: 'Cannot change the status of an administrator', code: 'CANNOT_MODIFY_ADMIN_STATUS' });

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        status: dto.status as any,
        isActive: dto.status === 'ACTIVE',
      },
      select: { id: true, email: true, status: true, isActive: true },
    });

    await this.auditService.log({
      adminId: admin.sub,
      adminEmail: admin.email,
      action: `USER_${dto.status}`,
      resourceType: 'user',
      resourceId: id,
      details: { reason: dto.reason, userEmail: user.email },
    });

    return updated;
  }

  async toggleAdmin(id: string, admin: JwtPayload) {
    if (id === admin.sub) throw new BadRequestException({ statusCode: 400, message: 'Cannot modify your own admin role', code: 'CANNOT_MODIFY_OWN_ADMIN_ROLE' });

    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true, isAdmin: true } });
    if (!user) throw new NotFoundException({ statusCode: 404, message: 'User not found', code: 'USER_NOT_FOUND' });

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isAdmin: !user.isAdmin },
      select: { id: true, email: true, isAdmin: true },
    });

    await this.auditService.log({
      adminId: admin.sub,
      adminEmail: admin.email,
      action: updated.isAdmin ? 'USER_PROMOTED_ADMIN' : 'USER_DEMOTED_ADMIN',
      resourceType: 'user',
      resourceId: id,
      details: { userEmail: user.email },
    });

    return updated;
  }
}
