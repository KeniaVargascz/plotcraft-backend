import { Injectable } from '@nestjs/common';
import { Chapter, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { BaseRepository } from '../base-repository.interface';

export const CHAPTER_REPOSITORY = 'CHAPTER_REPOSITORY';

@Injectable()
export class ChapterRepository implements BaseRepository<Chapter> {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Chapter | null> {
    return this.prisma.chapter.findUnique({ where: { id } });
  }

  async findMany(args?: Prisma.ChapterFindManyArgs): Promise<Chapter[]> {
    return this.prisma.chapter.findMany(args);
  }

  async create(data: Prisma.ChapterCreateArgs): Promise<Chapter> {
    return this.prisma.chapter.create(data);
  }

  async update(id: string, data: Prisma.ChapterUpdateInput): Promise<Chapter> {
    return this.prisma.chapter.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Chapter> {
    return this.prisma.chapter.delete({ where: { id } });
  }

  async count(args?: Prisma.ChapterCountArgs): Promise<number> {
    return this.prisma.chapter.count(args);
  }

  async findBySlug(novelId: string, slug: string): Promise<Chapter | null> {
    return this.prisma.chapter.findUnique({
      where: { novelId_slug: { novelId, slug } },
    });
  }
}
