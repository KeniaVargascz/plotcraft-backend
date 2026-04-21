import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { CacheService } from './cache.service';

/**
 * Implementación de CacheService con Redis (ioredis).
 * Usa la misma interfaz que MemoryCacheService, por lo que es un drop-in
 * replacement sin cambios en los servicios consumidores.
 *
 * Si Redis no está disponible, las operaciones fallan silenciosamente
 * y el servicio continúa funcionando (queries van directo a DB).
 */
@Injectable()
export class RedisCacheService implements CacheService, OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisCacheService.name);
  private isConnected = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      this.logger.warn('REDIS_URL not set — Redis cache disabled, falling back to no-op');
      this.client = null as any;
      return;
    }

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 200, 2000);
      },
      connectTimeout: 5000,
      lazyConnect: true,
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      this.logger.log('Redis connected');
    });

    this.client.on('error', (err) => {
      this.isConnected = false;
      this.logger.warn(`Redis error: ${err.message}`);
    });

    this.client.on('close', () => {
      this.isConnected = false;
    });

    this.client.connect().catch((err) => {
      this.logger.warn(`Redis initial connection failed: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => {});
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) return null;
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(`Redis GET error for key "${key}": ${(err as Error).message}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    if (!this.isConnected) return;
    try {
      const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`Redis SET error for key "${key}": ${(err as Error).message}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.client.del(key);
    } catch (err) {
      this.logger.warn(`Redis DEL error for key "${key}": ${(err as Error).message}`);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.isConnected) return;
    try {
      const redisPattern = pattern.replace(/\*/g, '*');
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor, 'MATCH', redisPattern, 'COUNT', 100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      this.logger.warn(`Redis invalidatePattern error: ${(err as Error).message}`);
    }
  }
}
