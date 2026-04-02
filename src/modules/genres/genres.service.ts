import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GenresService {
  constructor(private readonly prisma: PrismaService) {}

  listGenres() {
    return this.prisma.genre.findMany({
      orderBy: { label: 'asc' },
    });
  }
}
