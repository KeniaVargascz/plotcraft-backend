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
      throw new BadRequestException({ statusCode: 400, message: 'One or more genres do not exist', code: 'GENRES_NOT_FOUND' });
    }
  }

  async resolveLanguageId(languageId?: string) {
    if (languageId) {
      const language = await this.prisma.catalogLanguage.findUnique({
        where: { id: languageId },
        select: { id: true, isActive: true },
      });

      if (!language || !language.isActive) {
        throw new BadRequestException({ statusCode: 400, message: 'Selected language does not exist', code: 'LANGUAGE_NOT_FOUND' });
      }

      return language.id;
    }

    const fallback = await this.prisma.catalogLanguage.findUnique({
      where: { code: 'es' },
      select: { id: true, isActive: true },
    });

    if (!fallback || !fallback.isActive) {
      throw new BadRequestException({ statusCode: 400, message: 'No default language configured', code: 'DEFAULT_LANGUAGE_NOT_FOUND' });
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
      throw new BadRequestException({ statusCode: 400, message: 'Novel requires at least one published chapter to be public', code: 'NOVEL_NO_PUBLISHED_CHAPTERS' });
    }
  }

  async assertOwnsCharacters(userId: string, ids: string[]): Promise<void> {
    if (!ids.length) return;
    const characters = await this.prisma.character.findMany({
      where: { id: { in: ids } },
      select: { id: true, authorId: true },
    });
    if (characters.length !== ids.length) {
      throw new NotFoundException({ statusCode: 404, message: 'One or more characters do not exist', code: 'CHARACTERS_NOT_FOUND' });
    }
    const notOwned = characters.find((c) => c.authorId !== userId);
    if (notOwned) {
      throw new ForbiddenException({ statusCode: 403, message: 'You can only include your own characters in pairings', code: 'PAIRING_CHARACTERS_FORBIDDEN' });
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
