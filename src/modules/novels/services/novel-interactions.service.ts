import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  NOTIFICATIONS_SERVICE,
  INotificationsService,
} from '../../notifications/notifications.interface';

@Injectable()
export class NovelInteractionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATIONS_SERVICE)
    private readonly notificationsService: INotificationsService,
  ) {}

  async toggleLike(slug: string, userId: string) {
    const novel = await this.findAccessibleNovel(slug, userId);
    const existing = await this.prisma.novelLike.findUnique({
      where: {
        novelId_userId: {
          novelId: novel.id,
          userId,
        },
      },
    });

    if (existing) {
      await this.prisma.novelLike.delete({
        where: { id: existing.id },
      });

      return { hasLiked: false };
    }

    await this.prisma.novelLike.create({
      data: {
        novelId: novel.id,
        userId,
      },
    });

    if (novel.authorId !== userId) {
      // Check milestones: 100, 500, 1000, 5000
      const likesCount = await this.prisma.novelLike.count({
        where: { novelId: novel.id },
      });
      const milestones = [100, 500, 1000, 5000];
      if (milestones.includes(likesCount)) {
        void this.notificationsService.createNotification({
          userId: novel.authorId,
          type: 'NOVEL_MILESTONE' as any,
          title: `Tu novela alcanzo ${likesCount} likes!`,
          body: novel.title,
          actorId: userId,
        });
      }
    }

    return { hasLiked: true };
  }

  async toggleBookmark(slug: string, userId: string) {
    const novel = await this.findAccessibleNovel(slug, userId);
    const existing = await this.prisma.novelBookmark.findUnique({
      where: {
        novelId_userId: {
          novelId: novel.id,
          userId,
        },
      },
    });

    if (existing) {
      await this.prisma.novelBookmark.delete({
        where: { id: existing.id },
      });

      return { hasBookmarked: false };
    }

    await this.prisma.novelBookmark.create({
      data: {
        novelId: novel.id,
        userId,
      },
    });

    return { hasBookmarked: true };
  }

  private async findAccessibleNovel(slug: string, viewerId?: string | null) {
    const novel = await this.prisma.novel.findUnique({
      where: { slug },
    });

    if (!novel) {
      throw new NotFoundException({ statusCode: 404, message: 'Novel not found', code: 'NOVEL_NOT_FOUND' });
    }

    if (!novel.isPublic && novel.authorId !== viewerId) {
      throw new NotFoundException({ statusCode: 404, message: 'Novel not found', code: 'NOVEL_NOT_FOUND' });
    }

    return novel;
  }
}
