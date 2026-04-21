import { NotificationType } from '@prisma/client';
import { NotificationQueryDto } from './dto/notification-query.dto';

export const NOTIFICATIONS_SERVICE = 'NOTIFICATIONS_SERVICE';

export interface INotificationsService {
  createNotification(dto: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    url?: string;
    actorId?: string;
  }): Promise<void>;

  listNotifications(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<{
    data: unknown[];
    nextCursor: string | null;
    hasMore: boolean;
  }>;

  getUnreadCount(userId: string): Promise<{ count: number }>;

  markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<{ message: string }>;

  markAllAsRead(userId: string): Promise<{ updated: number }>;

  deleteNotification(
    notificationId: string,
    userId: string,
  ): Promise<{ message: string }>;

  deleteAll(userId: string): Promise<{ deleted: number }>;

  invalidateUnreadCount(userId: string): Promise<void>;
}
