import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CACHE_SERVICE, CacheService } from '../../common/services/cache.service';
import { NotificationQueryDto } from './dto/notification-query.dto';

const UNREAD_CACHE_TTL = 30_000; // 30 seconds

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  // ── Internal (called by other services, NOT an endpoint) ──

  async createNotification(dto: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    url?: string;
    actorId?: string;
  }): Promise<void> {
    const prefs = await this.prisma.notificationPreferences.upsert({
      where: { userId: dto.userId },
      create: { userId: dto.userId },
      update: {},
    });

    const typeEnabledMap: Record<NotificationType, boolean> = {
      NEW_FOLLOWER: prefs.newFollower,
      NEW_COMMENT: prefs.newCommentOnPost,
      NEW_REACTION: prefs.newReactionOnPost,
      NEW_REPLY: prefs.newReplyInThread,
      NEW_CHAPTER: prefs.newChapterFromFollowed,
      NOVEL_MILESTONE: prefs.novelMilestone,
      CHAPTER_PUBLISHED: prefs.newChapterFromFollowed,
      SYSTEM: true,
      COMMUNITY_APPROVED: true,
      COMMUNITY_REJECTED: true,
      COMMUNITY_REVIEW: true,
      SUGGESTION_APPROVED: true,
      SUGGESTION_REJECTED: true,
    };

    if (!typeEnabledMap[dto.type]) {
      return;
    }

    await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        url: dto.url ?? null,
        actorId: dto.actorId ?? null,
      },
    });

    await this.invalidateUnreadCount(dto.userId);
  }

  // ── CRUD ──

  async listNotifications(userId: string, query: NotificationQueryDto) {
    const take = query.limit ?? 20;

    const notifications = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(query.isRead !== undefined ? { isRead: query.isRead } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    const hasMore = notifications.length > take;
    const items = hasMore ? notifications.slice(0, take) : notifications;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      data: items,
      pagination: {
        nextCursor,
        hasMore,
        limit: take,
      },
    };
  }

  async getUnreadCount(userId: string) {
    const cacheKey = `unread:${userId}`;
    const cached = await this.cache.get<number>(cacheKey);
    if (cached !== null) return { count: cached };

    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    await this.cache.set(cacheKey, count, UNREAD_CACHE_TTL);
    return { count };
  }

  async invalidateUnreadCount(userId: string) {
    await this.cache.del(`unread:${userId}`);
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('You do not own this notification');
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    await this.invalidateUnreadCount(userId);
    return { message: 'Notification marked as read' };
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    await this.invalidateUnreadCount(userId);
    return { updated: result.count };
  }

  async deleteNotification(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('You do not own this notification');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    await this.invalidateUnreadCount(userId);
    return { message: 'Notification deleted' };
  }

  async deleteAll(userId: string) {
    const result = await this.prisma.notification.deleteMany({
      where: { userId },
    });

    await this.invalidateUnreadCount(userId);
    return { deleted: result.count };
  }
}
