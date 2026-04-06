import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VotesService {
  constructor(private readonly prisma: PrismaService) {}

  async castVote(userId: string, chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
    });

    if (!chapter) {
      throw new NotFoundException('Capitulo no encontrado');
    }

    const existing = await this.prisma.chapterVote.findUnique({
      where: { chapterId_userId: { chapterId, userId } },
    });

    if (existing) {
      throw new ConflictException('Ya has votado por este capitulo');
    }

    await this.prisma.$transaction([
      this.prisma.chapterVote.create({ data: { chapterId, userId } }),
      this.prisma.chapter.update({
        where: { id: chapterId },
        data: { votesCount: { increment: 1 } },
      }),
    ]);

    const updated = await this.prisma.chapter.findUniqueOrThrow({
      where: { id: chapterId },
    });

    return { chapterId, votesCount: updated.votesCount, hasVoted: true };
  }

  async removeVote(userId: string, chapterId: string) {
    const existing = await this.prisma.chapterVote.findUnique({
      where: { chapterId_userId: { chapterId, userId } },
    });

    if (!existing) {
      throw new NotFoundException('No has votado por este capitulo');
    }

    await this.prisma.$transaction([
      this.prisma.chapterVote.delete({ where: { id: existing.id } }),
      this.prisma.chapter.update({
        where: { id: existing.chapterId },
        data: { votesCount: { decrement: 1 } },
      }),
    ]);

    const updated = await this.prisma.chapter.findUniqueOrThrow({
      where: { id: existing.chapterId },
    });

    return {
      chapterId,
      votesCount: Math.max(0, updated.votesCount),
      hasVoted: false,
    };
  }

  async getVoteStatus(userId: string, chapterId: string) {
    const vote = await this.prisma.chapterVote.findUnique({
      where: { chapterId_userId: { chapterId, userId } },
    });

    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { votesCount: true },
    });

    return {
      chapterId,
      votesCount: chapter?.votesCount ?? 0,
      hasVoted: !!vote,
    };
  }

  async getNovelTotalVotes(novelId: string): Promise<number> {
    const result = await this.prisma.chapter.aggregate({
      where: { novelId },
      _sum: { votesCount: true },
    });
    return result._sum.votesCount ?? 0;
  }
}
