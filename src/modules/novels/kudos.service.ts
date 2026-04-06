import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NovelsService } from './novels.service';

@Injectable()
export class KudosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly novelsService: NovelsService,
  ) {}

  async addKudo(slug: string, userId: string) {
    const novel = await this.novelsService.findAccessibleNovel(slug, userId);

    if (novel.authorId === userId) {
      throw new ForbiddenException('No puedes dar kudo a tu propia novela');
    }

    const existing = await this.prisma.novelKudo.findUnique({
      where: { novelId_userId: { novelId: novel.id, userId } },
    });

    if (existing) {
      throw new ConflictException('Ya has dado kudo a esta novela');
    }

    await this.prisma.$transaction([
      this.prisma.novelKudo.create({
        data: { novelId: novel.id, userId },
      }),
      this.prisma.novel.update({
        where: { id: novel.id },
        data: { kudosCount: { increment: 1 } },
      }),
    ]);

    const updated = await this.prisma.novel.findUniqueOrThrow({
      where: { id: novel.id },
    });

    return { kudosCount: updated.kudosCount, hasKudo: true };
  }

  async removeKudo(slug: string, userId: string) {
    const novel = await this.novelsService.findAccessibleNovel(slug, userId);

    const existing = await this.prisma.novelKudo.findUnique({
      where: { novelId_userId: { novelId: novel.id, userId } },
    });

    if (!existing) {
      throw new NotFoundException('No has dado kudo a esta novela');
    }

    await this.prisma.$transaction([
      this.prisma.novelKudo.delete({ where: { id: existing.id } }),
      this.prisma.novel.update({
        where: { id: novel.id },
        data: { kudosCount: { decrement: 1 } },
      }),
    ]);

    const updated = await this.prisma.novel.findUniqueOrThrow({
      where: { id: novel.id },
    });

    return { kudosCount: Math.max(0, updated.kudosCount), hasKudo: false };
  }

  async hasKudo(novelId: string, userId: string): Promise<boolean> {
    const kudo = await this.prisma.novelKudo.findUnique({
      where: { novelId_userId: { novelId, userId } },
    });
    return !!kudo;
  }
}
