import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SearchHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getHistory(userId: string) {
    const history = await this.prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return { history };
  }

  async clearHistory(userId: string) {
    await this.prisma.searchHistory.deleteMany({
      where: { userId },
    });

    return { cleared: true };
  }

  async deleteHistoryEntry(userId: string, historyId: string) {
    await this.prisma.searchHistory.deleteMany({
      where: {
        id: historyId,
        userId,
      },
    });

    return { deleted: true };
  }

  recordHistoryAsync(userId: string | null | undefined, query: string) {
    if (!userId || query.trim().length < 2) {
      return;
    }

    void Promise.resolve()
      .then(async () => {
        await this.prisma.searchHistory.upsert({
          where: {
            userId_query: {
              userId,
              query: query.trim(),
            },
          },
          update: {
            createdAt: new Date(),
          },
          create: {
            userId,
            query: query.trim(),
          },
        });

        const overflow = await this.prisma.searchHistory.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip: 20,
          select: { id: true },
        });

        if (overflow.length) {
          await this.prisma.searchHistory.deleteMany({
            where: {
              id: {
                in: overflow.map((entry) => entry.id),
              },
            },
          });
        }
      })
      .catch(() => undefined);
  }
}
