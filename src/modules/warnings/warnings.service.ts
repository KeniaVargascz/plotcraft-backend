import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WarningsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const items = await this.prisma.catalogWarning.findMany({
      where: { isActive: true },
      orderBy: { label: 'asc' },
    });

    return items.map((item) => ({
      id: item.id,
      slug: item.slug,
      label: item.label,
    }));
  }
}
