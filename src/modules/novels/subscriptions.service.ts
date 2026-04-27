import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(slug: string, userId: string) {
    const novel = await this.prisma.novel.findUnique({ where: { slug } });
    if (!novel) throw new NotFoundException({ statusCode: 404, message: 'Novel not found', code: 'NOVEL_NOT_FOUND' });
    if (novel.authorId === userId) {
      throw new ForbiddenException({ statusCode: 403, message: 'You cannot subscribe to your own novel', code: 'SUBSCRIBE_OWN_NOVEL_FORBIDDEN' });
    }

    const existing = await this.prisma.novelSubscription.findUnique({
      where: { novelId_userId: { novelId: novel.id, userId } },
    });
    if (existing) {
      throw new ConflictException({ statusCode: 409, message: 'You are already subscribed to this novel', code: 'ALREADY_SUBSCRIBED' });
    }

    await this.prisma.$transaction([
      this.prisma.novelSubscription.create({
        data: { novelId: novel.id, userId },
      }),
      this.prisma.novel.update({
        where: { id: novel.id },
        data: { subscribersCount: { increment: 1 } },
      }),
    ]);

    const updated = await this.prisma.novel.findUniqueOrThrow({
      where: { id: novel.id },
    });
    return {
      subscribersCount: updated.subscribersCount,
      isSubscribed: true,
    };
  }

  async unsubscribe(slug: string, userId: string) {
    const novel = await this.prisma.novel.findUnique({ where: { slug } });
    if (!novel) throw new NotFoundException({ statusCode: 404, message: 'Novel not found', code: 'NOVEL_NOT_FOUND' });

    const existing = await this.prisma.novelSubscription.findUnique({
      where: { novelId_userId: { novelId: novel.id, userId } },
    });
    if (!existing) {
      throw new NotFoundException({ statusCode: 404, message: 'You are not subscribed to this novel', code: 'SUBSCRIPTION_NOT_FOUND' });
    }

    await this.prisma.$transaction([
      this.prisma.novelSubscription.delete({
        where: { novelId_userId: { novelId: novel.id, userId } },
      }),
      this.prisma.novel.update({
        where: { id: novel.id },
        data: { subscribersCount: { decrement: 1 } },
      }),
    ]);

    const updated = await this.prisma.novel.findUniqueOrThrow({
      where: { id: novel.id },
    });
    return {
      subscribersCount: Math.max(0, updated.subscribersCount),
      isSubscribed: false,
    };
  }

  async listMySubscriptions(userId: string, cursor?: string, limit = 20) {
    const subscriptions = await this.prisma.novelSubscription.findMany({
      where: { userId },
      take: limit + 1,
      ...(cursor
        ? {
            skip: 1,
            cursor: { novelId_userId: { novelId: cursor, userId } },
          }
        : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        novel: {
          include: {
            author: { include: { profile: true } },
            chapters: {
              where: { status: 'PUBLISHED' },
              orderBy: { publishedAt: 'desc' },
              take: 1,
              select: {
                id: true,
                title: true,
                slug: true,
                publishedAt: true,
              },
            },
          },
        },
      },
    });

    const hasMore = subscriptions.length > limit;
    const items = subscriptions.slice(0, limit);

    return {
      data: items.map((s) => ({
        id: s.novel.id,
        title: s.novel.title,
        slug: s.novel.slug,
        coverUrl: s.novel.coverUrl,
        subscribedAt: s.createdAt,
        author: {
          id: s.novel.author.id,
          username: s.novel.author.username,
          displayName:
            s.novel.author.profile?.displayName ?? s.novel.author.username,
          avatarUrl: s.novel.author.profile?.avatarUrl ?? null,
        },
        latestChapter: s.novel.chapters[0] ?? null,
      })),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.novelId ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  async isSubscribed(novelId: string, userId: string): Promise<boolean> {
    const sub = await this.prisma.novelSubscription.findUnique({
      where: { novelId_userId: { novelId, userId } },
    });
    return !!sub;
  }
}
