import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CACHE_SERVICE, CacheService } from '../../common/services/cache.service';

const CATALOG_TTL = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class RomanceGenresService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  async listRomanceGenres() {
    const cached = await this.cache.get<unknown[]>('catalog:romance-genres');
    if (cached) return cached;

    const romanceGenres = await this.prisma.catalogRomanceGenre.findMany({
      where: { isActive: true },
      orderBy: [{ label: 'asc' }],
      select: {
        id: true,
        slug: true,
        label: true,
        isActive: true,
      },
    });

    await this.cache.set('catalog:romance-genres', romanceGenres, CATALOG_TTL);
    return romanceGenres;
  }
}
