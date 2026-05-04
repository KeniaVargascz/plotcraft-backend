import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';
import { Role, hasRole, type RoleId } from '../../../common/constants/roles';

interface UsersQuery {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  role?: number;
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
    if (query.role !== undefined) {
      where.role = query.role;
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
          role: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
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
        role: true,
        createdAt: true,
        updatedAt: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        lastLoginAt: true,
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
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true, isAdmin: true, role: true } });
    if (!user) throw new NotFoundException({ statusCode: 404, message: 'User not found', code: 'USER_NOT_FOUND' });
    if (hasRole(user.role, Role.MASTER)) throw new BadRequestException({ statusCode: 400, message: 'Cannot change the status of an administrator', code: 'CANNOT_MODIFY_ADMIN_STATUS' });

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

  async updateRole(id: string, newRole: number, admin: JwtPayload) {
    if (id === admin.sub) throw new BadRequestException({ statusCode: 400, message: 'Cannot modify your own role', code: 'CANNOT_MODIFY_OWN_ROLE' });

    const validRoles: number[] = Object.values(Role);
    if (!validRoles.includes(newRole)) {
      throw new BadRequestException({ statusCode: 400, message: `Invalid role. Must be one of: ${validRoles.join(', ')}`, code: 'INVALID_ROLE' });
    }

    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true, role: true } });
    if (!user) throw new NotFoundException({ statusCode: 404, message: 'User not found', code: 'USER_NOT_FOUND' });

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role: newRole, isAdmin: newRole >= Role.ADMIN },
      select: { id: true, email: true, isAdmin: true, role: true },
    });

    const action = newRole > user.role ? 'USER_ROLE_PROMOTED' : 'USER_ROLE_DEMOTED';
    await this.auditService.log({
      adminId: admin.sub,
      adminEmail: admin.email,
      action,
      resourceType: 'user',
      resourceId: id,
      details: { userEmail: user.email, previousRole: user.role, newRole },
    });

    return updated;
  }
}
