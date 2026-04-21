import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChapterStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class NovelValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async assertGenresExist(genreIds: string[]) {
    if (!genreIds.length) {
      return;
    }

    const count = await this.prisma.genre.count({
      where: {
        id: {
          in: genreIds,
        },
      },
    });

    if (count !== genreIds.length) {
      throw new BadRequestException('Uno o mas generos no existen');
    }
  }

  async resolveLanguageId(languageId?: string) {
    if (languageId) {
      const language = await this.prisma.catalogLanguage.findUnique({
        where: { id: languageId },
        select: { id: true, isActive: true },
      });

      if (!language || !language.isActive) {
        throw new BadRequestException('El idioma seleccionado no existe');
      }

      return language.id;
    }

    const fallback = await this.prisma.catalogLanguage.findUnique({
      where: { code: 'es' },
      select: { id: true, isActive: true },
    });

    if (!fallback || !fallback.isActive) {
      throw new BadRequestException(
        'No existe un idioma por defecto configurado',
      );
    }

    return fallback.id;
  }

  async assertPublicRequirements(novelId: string) {
    const publishedChapters = await this.prisma.chapter.count({
      where: {
        novelId,
        status: ChapterStatus.PUBLISHED,
      },
    });

    if (!publishedChapters) {
      throw new BadRequestException(
        'La novela necesita al menos un capitulo publicado para ser publica',
      );
    }
  }

  async assertOwnsCharacters(userId: string, ids: string[]): Promise<void> {
    if (!ids.length) return;
    const characters = await this.prisma.character.findMany({
      where: { id: { in: ids } },
      select: { id: true, authorId: true },
    });
    if (characters.length !== ids.length) {
      throw new NotFoundException('Uno o mas personajes no existen');
    }
    const notOwned = characters.find((c) => c.authorId !== userId);
    if (notOwned) {
      throw new ForbiddenException(
        'Solo puedes incluir personajes propios en las parejas',
      );
    }
  }

  collectPairingCharacterIds(
    pairings?: { characterAId: string; characterBId: string }[],
  ): string[] {
    if (!pairings?.length) return [];
    const ids = new Set<string>();
    for (const p of pairings) {
      ids.add(p.characterAId);
      ids.add(p.characterBId);
    }
    return Array.from(ids);
  }

  async replacePairings(
    novelId: string,
    pairings: {
      characterAId: string;
      characterBId: string;
      isMain?: boolean;
    }[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.novelPairing.deleteMany({ where: { novelId } }),
      ...(pairings.length
        ? [
            this.prisma.novelPairing.createMany({
              data: pairings.map((p, index) => ({
                novelId,
                characterAId: p.characterAId,
                characterBId: p.characterBId,
                isMain: p.isMain ?? false,
                sortOrder: index,
              })),
            }),
          ]
        : []),
    ]);
  }
}
