import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService, CACHE_SERVICE } from './cache.service';

const FLAGS_LAST_CHANGED_KEY = 'flags:lastChanged';
const FLAGS_LAST_CHANGED_TTL_MS = 24 * 60 * 60 * 1000; // 24h

@Injectable()
export class FeatureFlagCacheService {
  private readonly logger = new Logger(FeatureFlagCacheService.name);
  private flagsCache = new Map<string, boolean>();
  private lastRefresh = 0;
  private readonly TTL = 60_000; // 60 seconds

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  async isEnabled(key: string): Promise<boolean> {
    await this.refreshIfStale();
    if (!this.flagsCache.has(key)) {
      this.logger.warn(`Unknown feature flag requested: "${key}"`);
      return false;
    }
    return this.flagsCache.get(key)!;
  }

  async getActiveFlags(): Promise<string[]> {
    await this.refreshIfStale();
    return Array.from(this.flagsCache.entries())
      .filter(([, enabled]) => enabled)
      .map(([key]) => key);
  }

  async getLastChangedTimestamp(): Promise<number | null> {
    return this.cache.get<number>(FLAGS_LAST_CHANGED_KEY);
  }

  private async refreshIfStale(): Promise<void> {
    const now = Date.now();
    if (now - this.lastRefresh < this.TTL) return;

    try {
      const flags = await this.prisma.adminFeatureFlag.findMany({
        select: { key: true, enabled: true },
      });
      this.flagsCache.clear();
      for (const flag of flags) {
        this.flagsCache.set(flag.key, flag.enabled);
      }
      this.lastRefresh = now;
    } catch (error) {
      this.logger.warn('Failed to refresh feature flags, using cached values');
    }
  }

  async invalidate(): Promise<void> {
    this.lastRefresh = 0;
    await this.cache.set(
      FLAGS_LAST_CHANGED_KEY,
      Math.floor(Date.now() / 1000),
      FLAGS_LAST_CHANGED_TTL_MS,
    );
  }
}
