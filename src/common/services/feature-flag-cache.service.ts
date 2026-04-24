import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FeatureFlagCacheService {
  private readonly logger = new Logger(FeatureFlagCacheService.name);
  private cache = new Map<string, boolean>();
  private lastRefresh = 0;
  private readonly TTL = 60_000; // 60 seconds

  constructor(private readonly prisma: PrismaService) {}

  async isEnabled(key: string): Promise<boolean> {
    await this.refreshIfStale();
    // If flag doesn't exist in DB, default to enabled
    return this.cache.get(key) ?? true;
  }

  async getActiveFlags(): Promise<string[]> {
    await this.refreshIfStale();
    return Array.from(this.cache.entries())
      .filter(([, enabled]) => enabled)
      .map(([key]) => key);
  }

  private async refreshIfStale(): Promise<void> {
    const now = Date.now();
    if (now - this.lastRefresh < this.TTL) return;

    try {
      const flags = await this.prisma.adminFeatureFlag.findMany({
        select: { key: true, enabled: true },
      });
      this.cache.clear();
      for (const flag of flags) {
        this.cache.set(flag.key, flag.enabled);
      }
      this.lastRefresh = now;
    } catch (error) {
      this.logger.warn('Failed to refresh feature flags, using cached values');
    }
  }

  invalidate(): void {
    this.lastRefresh = 0;
  }
}
