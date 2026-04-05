import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FollowsService } from '../../modules/follows/follows.service';
import { createUserFixture } from '../helpers/fixtures.helper';

describe('FollowsService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    follow: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  } as any;

  const notificationsService = {
    createNotification: jest.fn(),
  } as any;

  let service: FollowsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FollowsService(prisma, notificationsService);
  });

  it('followUser throws when user tries to follow themselves', async () => {
    prisma.user.findUnique.mockResolvedValue(createUserFixture({ id: 'me-id' }));

    await expect(service.followUser('me-id', 'testuser')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('followUser throws ConflictException if already following', async () => {
    prisma.user.findUnique.mockResolvedValue(createUserFixture({ id: 'target-id' }));
    prisma.follow.findUnique.mockResolvedValue({ id: 'follow-id' });

    await expect(service.followUser('me-id', 'target')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('unfollowUser throws NotFoundException if not following', async () => {
    prisma.user.findUnique.mockResolvedValue(createUserFixture({ id: 'target-id' }));
    prisma.follow.findUnique.mockResolvedValue(null);

    await expect(service.unfollowUser('me-id', 'target')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getSuggestions excludes requesting user and limits results to 10', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await service.getSuggestions('me-id');

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: 'me-id' },
        }),
        take: 10,
      }),
    );
  });
});
