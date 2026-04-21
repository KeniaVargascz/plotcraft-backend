import { Global, Module } from '@nestjs/common';
import { CACHE_SERVICE, MemoryCacheService } from './services/cache.service';
import { RedisCacheService } from './services/redis-cache.service';

/**
 * Módulo global de cache.
 * - Si REDIS_URL está definido: usa RedisCacheService (ioredis → Upstash/Redis)
 * - Si no: usa MemoryCacheService (Map en memoria, desarrollo)
 *
 * Al ser @Global(), cualquier módulo puede inyectar CACHE_SERVICE sin importar nada.
 */
@Global()
@Module({
  providers: [
    {
      provide: CACHE_SERVICE,
      useClass: process.env.REDIS_URL ? RedisCacheService : MemoryCacheService,
    },
  ],
  exports: [CACHE_SERVICE],
})
export class CacheModule {}
