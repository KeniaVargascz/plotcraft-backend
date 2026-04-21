import { Injectable } from '@nestjs/common';
import { Novel, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { BaseRepository } from '../base-repository.interface';

export const NOVEL_REPOSITORY = 'NOVEL_REPOSITORY';

@Injectable()
export class NovelRepository implements BaseRepository<Novel> {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Novel | null> {
    return this.prisma.novel.findUnique({ where: { id } });
  }

  async findMany(args?: Prisma.NovelFindManyArgs): Promise<Novel[]> {
    return this.prisma.novel.findMany(args);
  }

  async create(data: Prisma.NovelCreateArgs): Promise<Novel> {
    return this.prisma.novel.create(data);
  }

  async update(id: string, data: Prisma.NovelUpdateInput): Promise<Novel> {
    return this.prisma.novel.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Novel> {
    return this.prisma.novel.delete({ where: { id } });
  }

  async count(args?: Prisma.NovelCountArgs): Promise<number> {
    return this.prisma.novel.count(args);
  }

  async findBySlug(slug: string): Promise<Novel | null> {
    return this.prisma.novel.findUnique({ where: { slug } });
  }
}
