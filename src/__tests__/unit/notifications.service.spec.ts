import { ForbiddenException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { createNotificationFixture } from '../helpers/fixtures.helper';

describe('NotificationsService', () => {
  const prisma = {
    notificationPreferences: {
      upsert: jest.fn(),
    },
    notification: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
  } as any;

  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    const mockCache = { get: async () => null, set: async () => {}, del: async () => {}, invalidatePattern: async () => {} };
    service = new NotificationsService(prisma, mockCache as any);
  });

  it('createNotification does not persist notification if preference is disabled', async () => {
    prisma.notificationPreferences.upsert.mockResolvedValue({
      newFollower: false,
      newCommentOnPost: true,
      newReactionOnPost: true,
      newReplyInThread: true,
      newChapterFromFollowed: true,
      novelMilestone: true,
    });

    await service.createNotification({
      userId: 'user-id',
      type: NotificationType.NEW_FOLLOWER,
      title: 'Nuevo seguidor',
      body: 'Body',
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('markAsRead throws ForbiddenException when notification belongs to another user', async () => {
    prisma.notification.findUnique.mockResolvedValue(
      createNotificationFixture({ userId: 'another-user' }),
    );

    await expect(
      service.markAsRead('notification-id', 'user-id'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
