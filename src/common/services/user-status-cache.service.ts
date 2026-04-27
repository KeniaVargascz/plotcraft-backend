import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService, CACHE_SERVICE } from './cache.service';

interface UserStatus {
  exists: boolean;
  isActive: boolean;
  isAdmin: boolean;
  failedLoginAttempts: number;
  lockedUntil: string | null;
}

const USER_STATUS_TTL_MS = 30_000; // 30 seconds

@Injectable()
export class UserStatusCacheService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  async getStatus(userId: string): Promise<UserStatus> {
    const cacheKey = `user:status:${userId}`;
    const cached = await this.cache.get<UserStatus>(cacheKey);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        isActive: true,
        isAdmin: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    });

    const status: UserStatus = user
      ? {
          exists: true,
          isActive: user.isActive,
          isAdmin: user.isAdmin,
          failedLoginAttempts: user.failedLoginAttempts,
          lockedUntil: user.lockedUntil?.toISOString() ?? null,
        }
      : { exists: false, isActive: false, isAdmin: false, failedLoginAttempts: 0, lockedUntil: null };

    await this.cache.set(cacheKey, status, USER_STATUS_TTL_MS);
    return status;
  }

  async getAdminStatus(userId: string): Promise<{ isAdmin: boolean }> {
    const status = await this.getStatus(userId);
    return { isAdmin: status.isAdmin };
  }

  async invalidate(userId: string): Promise<void> {
    await this.cache.del(`user:status:${userId}`);
  }
}
