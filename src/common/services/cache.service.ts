import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export const CACHE_SERVICE = 'CACHE_SERVICE';

/**
 * Interfaz de cache genérica.
 * Implementación actual: Map en memoria (desarrollo).
 * TODO: Reemplazar con ioredis en producción (ver D1.5 — Redis Cache).
 */
export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  del(key: string): Promise<void>;
  invalidatePattern(pattern: string): Promise<void>;
}

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const MAX_ENTRIES = 500;
const CLEANUP_INTERVAL_MS = 60_000;

/**
 * Implementación en memoria con límite de entradas y cleanup periódico.
 * En producción, inyectar RedisCacheService que implementa CacheService.
 */
@Injectable()
export class MemoryCacheService implements CacheService, OnModuleDestroy {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly logger = new Logger(MemoryCacheService.name);
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupTimer = setInterval(() => this.evictExpired(), CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupTimer);
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      if (entry) this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    if (this.store.size >= MAX_ENTRIES) {
      this.evictExpired();
      // If still at limit after eviction, remove oldest entry
      if (this.store.size >= MAX_ENTRIES) {
        const firstKey = this.store.keys().next().value;
        if (firstKey) this.store.delete(firstKey);
      }
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
      }
    }
  }

  private evictExpired(): void {
    const now = Date.now();
    let evicted = 0;
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
        evicted++;
      }
    }
    if (evicted > 0) {
      this.logger.debug(`Evicted ${evicted} expired cache entries`);
    }
  }
}
