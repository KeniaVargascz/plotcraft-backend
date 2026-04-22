import { SetMetadata } from '@nestjs/common';

export const CACHE_TTL_KEY = 'cacheTtl';

/**
 * Sets a custom Cache-Control max-age (in seconds) for a public endpoint.
 * Only applies to @Public() GET endpoints. Private endpoints always get no-store.
 *
 * @example @CacheTtl(86400) // 24 hours for catalogs
 * @example @CacheTtl(300)   // 5 minutes for discovery
 */
export const CacheTtl = (seconds: number) =>
  SetMetadata(CACHE_TTL_KEY, seconds);
