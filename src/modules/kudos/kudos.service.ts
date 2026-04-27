import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type KudoTargetType = 'novel' | 'character' | 'world';

@Injectable()
export class KudosService {
  constructor(private readonly prisma: PrismaService) {}

  async addCharacterKudo(characterId: string, userId: string) {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new NotFoundException({ statusCode: 404, message: 'Character not found', code: 'CHARACTER_NOT_FOUND' });
    }

    if (character.authorId === userId) {
      throw new ForbiddenException({ statusCode: 403, message: 'You cannot give kudos to your own character', code: 'KUDO_OWN_CHARACTER_FORBIDDEN' });
    }

    const existing = await this.prisma.characterKudo.findUnique({
      where: { characterId_userId: { characterId, userId } },
    });

    if (existing) {
      throw new ConflictException({ statusCode: 409, message: 'You have already given kudos to this character', code: 'CHARACTER_KUDO_ALREADY_EXISTS' });
    }

    await this.prisma.$transaction([
      this.prisma.characterKudo.create({ data: { characterId, userId } }),
      this.prisma.character.update({
        where: { id: characterId },
        data: { kudosCount: { increment: 1 } },
      }),
    ]);

    const updated = await this.prisma.character.findUniqueOrThrow({
      where: { id: characterId },
    });

    return { kudosCount: updated.kudosCount, hasKudo: true };
  }

  async removeCharacterKudo(characterId: string, userId: string) {
    const existing = await this.prisma.characterKudo.findUnique({
      where: { characterId_userId: { characterId, userId } },
    });

    if (!existing) {
      throw new NotFoundException({ statusCode: 404, message: 'You have not given kudos to this character', code: 'CHARACTER_KUDO_NOT_FOUND' });
    }

    await this.prisma.$transaction([
      this.prisma.characterKudo.delete({ where: { id: existing.id } }),
      this.prisma.character.update({
        where: { id: existing.characterId },
        data: { kudosCount: { decrement: 1 } },
      }),
    ]);

    const updated = await this.prisma.character.findUniqueOrThrow({
      where: { id: existing.characterId },
    });

    return { kudosCount: Math.max(0, updated.kudosCount), hasKudo: false };
  }

  async addWorldKudo(worldId: string, userId: string) {
    const world = await this.prisma.world.findUnique({
      where: { id: worldId },
    });

    if (!world) {
      throw new NotFoundException({ statusCode: 404, message: 'World not found', code: 'WORLD_NOT_FOUND' });
    }

    if (world.authorId === userId) {
      throw new ForbiddenException({ statusCode: 403, message: 'You cannot give kudos to your own world', code: 'KUDO_OWN_WORLD_FORBIDDEN' });
    }

    const existing = await this.prisma.worldKudo.findUnique({
      where: { worldId_userId: { worldId, userId } },
    });

    if (existing) {
      throw new ConflictException({ statusCode: 409, message: 'You have already given kudos to this world', code: 'WORLD_KUDO_ALREADY_EXISTS' });
    }

    await this.prisma.$transaction([
      this.prisma.worldKudo.create({ data: { worldId, userId } }),
      this.prisma.world.update({
        where: { id: worldId },
        data: { kudosCount: { increment: 1 } },
      }),
    ]);

    const updated = await this.prisma.world.findUniqueOrThrow({
      where: { id: worldId },
    });

    return { kudosCount: updated.kudosCount, hasKudo: true };
  }

  async removeWorldKudo(worldId: string, userId: string) {
    const existing = await this.prisma.worldKudo.findUnique({
      where: { worldId_userId: { worldId, userId } },
    });

    if (!existing) {
      throw new NotFoundException({ statusCode: 404, message: 'You have not given kudos to this world', code: 'WORLD_KUDO_NOT_FOUND' });
    }

    await this.prisma.$transaction([
      this.prisma.worldKudo.delete({ where: { id: existing.id } }),
      this.prisma.world.update({
        where: { id: existing.worldId },
        data: { kudosCount: { decrement: 1 } },
      }),
    ]);

    const updated = await this.prisma.world.findUniqueOrThrow({
      where: { id: existing.worldId },
    });

    return { kudosCount: Math.max(0, updated.kudosCount), hasKudo: false };
  }

  async hasCharacterKudo(
    characterId: string,
    userId: string,
  ): Promise<boolean> {
    const kudo = await this.prisma.characterKudo.findUnique({
      where: { characterId_userId: { characterId, userId } },
    });
    return !!kudo;
  }

  async hasWorldKudo(worldId: string, userId: string): Promise<boolean> {
    const kudo = await this.prisma.worldKudo.findUnique({
      where: { worldId_userId: { worldId, userId } },
    });
    return !!kudo;
  }
}
