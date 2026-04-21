import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { QueueService } from './queue.interface';

/**
 * Redis-backed queue using LPUSH/RPOP (S — Single Responsibility: only queue ops).
 * Falls back to no-op if Redis is unavailable.
 */
@Injectable()
export class RedisQueueService implements QueueService, OnModuleDestroy {
  private readonly client: Redis | null;
  private readonly logger = new Logger(RedisQueueService.name);

  constructor() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.warn('REDIS_URL not set — queue disabled');
      this.client = null;
      return;
    }

    this.client = new Redis(url, {
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)),
      connectTimeout: 5000,
      lazyConnect: true,
    });

    this.client.on('error', (err) =>
      this.logger.warn(`Redis queue error: ${err.message}`),
    );

    this.client.connect().catch((err) =>
      this.logger.warn(`Redis queue connect failed: ${err.message}`),
    );
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => {});
  }

  async enqueue<T>(queue: string, payload: T): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.lpush(`queue:${queue}`, JSON.stringify(payload));
    } catch (err) {
      this.logger.warn(`enqueue error on "${queue}": ${(err as Error).message}`);
    }
  }

  async dequeue<T>(queue: string, batchSize: number): Promise<T[]> {
    if (!this.client) return [];
    try {
      const items: T[] = [];
      for (let i = 0; i < batchSize; i++) {
        const raw = await this.client.rpop(`queue:${queue}`);
        if (!raw) break;
        items.push(JSON.parse(raw) as T);
      }
      return items;
    } catch (err) {
      this.logger.warn(`dequeue error on "${queue}": ${(err as Error).message}`);
      return [];
    }
  }

  async length(queue: string): Promise<number> {
    if (!this.client) return 0;
    try {
      return await this.client.llen(`queue:${queue}`);
    } catch {
      return 0;
    }
  }
}
