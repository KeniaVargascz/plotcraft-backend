import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CANONICAL_GENRE_SLUGS } from './genre-catalog';

@Injectable()
export class GenresService {
  constructor(private readonly prisma: PrismaService) {}

  listGenres() {
    return this.prisma.genre.findMany({
      where: {
        slug: {
          in: CANONICAL_GENRE_SLUGS,
        },
      },
      orderBy: { label: 'asc' },
    });
  }
}
