import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CACHE_SERVICE, CacheService } from '../../common/services/cache.service';

type ProgressEntry = {
  userId: string;
  novelId: string;
  chapterId: string;
  scrollPct: number;
};

const BUFFER_KEY = 'buffer:reading-progress';
const FLUSH_INTERVAL_MS = 15_000; // Flush every 15 seconds

/**
 * Buffers reading progress updates in Redis, flushes to DB periodically
 * (S — Single Responsibility: only progress buffering).
 *
 * Before: every scroll event = 1 DB UPSERT
 * After: N scroll events buffered in Redis, 1 batch UPSERT per flush cycle
 */
@Injectable()
export class ReadingProgressBuffer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReadingProgressBuffer.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Buffer a progress update. Overwrites previous value for same user+novel
   * so only the latest scroll position is persisted.
   */
  async buffer(entry: ProgressEntry): Promise<void> {
    const key = `${BUFFER_KEY}:${entry.userId}:${entry.novelId}`;
    await this.cache.set(key, entry, FLUSH_INTERVAL_MS * 3);
  }

  /**
   * Flush all buffered progress to DB. Uses pattern match to find keys.
   */
  private async flush() {
    if (this.flushing) return;
    this.flushing = true;

    try {
      // Invalidate pattern returns void; we need to scan keys manually via cache
      // Since CacheService doesn't expose scan, we rely on a known key structure
      // and use the cache get/del for each known key. For the Redis implementation,
      // we use invalidatePattern as a proxy to get keys.
      //
      // Alternative: keep an in-memory set of buffered keys.
      // This is simpler and avoids coupling to Redis SCAN.
      const entries = await this.drainBufferedEntries();

      if (!entries.length) return;

      // Deduplicate: keep last entry per user+novel
      const latest = new Map<string, ProgressEntry>();
      for (const entry of entries) {
        latest.set(`${entry.userId}:${entry.novelId}`, entry);
      }

      // Batch upsert
      const operations = [...latest.values()].map((entry) =>
        this.prisma.readingProgress.upsert({
          where: {
            userId_novelId: {
              userId: entry.userId,
              novelId: entry.novelId,
            },
          },
          update: {
            chapterId: entry.chapterId,
            scrollPct: entry.scrollPct,
          },
          create: {
            userId: entry.userId,
            novelId: entry.novelId,
            chapterId: entry.chapterId,
            scrollPct: entry.scrollPct,
          },
        }),
      );

      await this.prisma.$transaction(operations);

      if (latest.size > 0) {
        this.logger.debug(`Flushed ${latest.size} reading progress entries`);
      }
    } catch (err) {
      this.logger.error(`Progress flush error: ${(err as Error).message}`);
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Drains buffered entries by checking known keys.
   * Keeps a local registry of pending keys to avoid Redis SCAN dependency.
   */
  private pendingKeys = new Set<string>();

  async addPendingKey(userId: string, novelId: string) {
    this.pendingKeys.add(`${BUFFER_KEY}:${userId}:${novelId}`);
  }

  private async drainBufferedEntries(): Promise<ProgressEntry[]> {
    const entries: ProgressEntry[] = [];
    const keysToProcess = [...this.pendingKeys];
    this.pendingKeys.clear();

    for (const key of keysToProcess) {
      const entry = await this.cache.get<ProgressEntry>(key);
      if (entry) {
        entries.push(entry);
        await this.cache.del(key);
      }
    }

    return entries;
  }
}
