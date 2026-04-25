import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CACHE_SERVICE, CacheService } from '../../common/services/cache.service';

const CATALOG_TTL = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class LanguagesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  async listLanguages() {
    const cached = await this.cache.get<unknown[]>('catalog:languages');
    if (cached) return cached;

    const languages = await this.prisma.catalogLanguage.findMany({
      where: { isActive: true },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true,
      },
    });

    await this.cache.set('catalog:languages', languages, CATALOG_TTL);
    return languages;
  }
}
