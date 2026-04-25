import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CACHE_SERVICE, CacheService } from '../../common/services/cache.service';
import { CANONICAL_GENRE_SLUGS } from './genre-catalog';

const CATALOG_TTL = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class GenresService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  async listGenres() {
    const cached = await this.cache.get<unknown[]>('catalog:genres');
    if (cached) return cached;

    const genres = await this.prisma.genre.findMany({
      where: { slug: { in: CANONICAL_GENRE_SLUGS }, isActive: true },
      orderBy: { label: 'asc' },
    });

    await this.cache.set('catalog:genres', genres, CATALOG_TTL);
    return genres;
  }
}
