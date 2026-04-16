import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RomanceGenresService {
  constructor(private readonly prisma: PrismaService) {}

  listRomanceGenres() {
    return this.prisma.catalogRomanceGenre.findMany({
      where: { isActive: true },
      orderBy: [{ label: 'asc' }],
      select: {
        id: true,
        slug: true,
        label: true,
        isActive: true,
      },
    });
  }
}
