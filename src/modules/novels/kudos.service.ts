import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NOVELS_SERVICE, INovelsService } from './novels.interface';

@Injectable()
export class KudosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOVELS_SERVICE)
    private readonly novelsService: INovelsService,
  ) {}

  async addKudo(slug: string, userId: string) {
    const novel = await this.novelsService.findAccessibleNovel(slug, userId);

    if (novel.authorId === userId) {
      throw new ForbiddenException({ statusCode: 403, message: 'You cannot give kudos to your own novel', code: 'KUDO_OWN_NOVEL_FORBIDDEN' });
    }

    const existing = await this.prisma.novelKudo.findUnique({
      where: { novelId_userId: { novelId: novel.id, userId } },
    });

    if (existing) {
      throw new ConflictException({ statusCode: 409, message: 'You have already given kudos to this novel', code: 'KUDO_ALREADY_GIVEN' });
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
      throw new NotFoundException({ statusCode: 404, message: 'You have not given kudos to this novel', code: 'KUDO_NOT_FOUND' });
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
