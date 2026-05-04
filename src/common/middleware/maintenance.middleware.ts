import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService, CACHE_SERVICE } from '../services/cache.service';
import { Inject } from '@nestjs/common';

const CACHE_KEY = 'app:maintenanceMode';
const CACHE_TTL_MS = 10_000; // 10 seconds

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Always allow admin routes and public status endpoints
    const path = req.originalUrl || req.url;
    if (
      path.includes('/admin/') ||
      path.includes('/features/maintenance') ||
      path.includes('/features/active') ||
      path.includes('/features/banner') ||
      path.includes('/auth/login') ||
      path.includes('/auth/refresh')
    ) {
      return next();
    }

    const enabled = await this.isMaintenanceEnabled();
    if (enabled) {
      res.status(503).json({
        success: false,
        error: {
          statusCode: 503,
          message: 'Application is under maintenance',
          code: 'MAINTENANCE_MODE',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  }

  private async isMaintenanceEnabled(): Promise<boolean> {
    const cached = await this.cache.get<boolean>(CACHE_KEY);
    if (cached !== null) return cached;

    const setting = await this.prisma.appSetting.findUnique({
      where: { key: 'maintenanceMode' },
    });
    const enabled = setting?.value === 'true';
    await this.cache.set(CACHE_KEY, enabled, CACHE_TTL_MS);
    return enabled;
  }
}
