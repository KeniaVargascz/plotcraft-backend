import { Injectable } from '@nestjs/common';

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

/**
 * Implementación en memoria para desarrollo.
 * En producción, inyectar RedisCacheService que implementa CacheService.
 */
@Injectable()
export class MemoryCacheService implements CacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      if (entry) this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
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
}
