import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CACHE_SERVICE, CacheService } from '../../common/services/cache.service';

const CATALOG_TTL = 24 * 60 * 60 * 1000;

@Injectable()
export class WarningsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  async list() {
    const cached = await this.cache.get<unknown[]>('catalog:warnings');
    if (cached) return cached;

    const items = await this.prisma.catalogWarning.findMany({
      where: { isActive: true },
      orderBy: { label: 'asc' },
    });

    const result = items.map((item) => ({
      id: item.id,
      slug: item.slug,
      label: item.label,
    }));

    await this.cache.set('catalog:warnings', result, CATALOG_TTL);
    return result;
  }
}
