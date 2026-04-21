import { Injectable } from '@nestjs/common';
import { Character, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { BaseRepository } from '../base-repository.interface';

export const CHARACTER_REPOSITORY = 'CHARACTER_REPOSITORY';

@Injectable()
export class CharacterRepository implements BaseRepository<Character> {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Character | null> {
    return this.prisma.character.findUnique({ where: { id } });
  }

  async findMany(args?: Prisma.CharacterFindManyArgs): Promise<Character[]> {
    return this.prisma.character.findMany(args);
  }

  async create(data: Prisma.CharacterCreateArgs): Promise<Character> {
    return this.prisma.character.create(data);
  }

  async update(id: string, data: Prisma.CharacterUpdateInput): Promise<Character> {
    return this.prisma.character.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Character> {
    return this.prisma.character.delete({ where: { id } });
  }

  async count(args?: Prisma.CharacterCountArgs): Promise<number> {
    return this.prisma.character.count(args);
  }

  async findBySlug(authorId: string, slug: string): Promise<Character | null> {
    return this.prisma.character.findUnique({
      where: { authorId_slug: { authorId, slug } },
    });
  }
}
