import { BadRequestException } from '@nestjs/common';
import { NovelStatus } from '@prisma/client';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { NovelsService } from '../../modules/novels/novels.service';
import { createNovelFixture } from '../helpers/fixtures.helper';

describe('NovelsService', () => {
  const prisma = {
    genre: {
      count: jest.fn(),
    },
    novel: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    chapter: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    novelLike: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    novelBookmark: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    },
    catalogLanguage: {
      findUnique: jest.fn(),
    },
    character: {
      findMany: jest.fn(),
    },
  } as any;

  const notificationsService = {
    createNotification: jest.fn(),
  } as unknown as NotificationsService;

  let service: NovelsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NovelsService(prisma, notificationsService);
  });

  it('createNovel generates slug and assigns authorId from authenticated user', async () => {
    prisma.genre.count.mockResolvedValue(0);
    prisma.catalogLanguage.findUnique.mockResolvedValue({
      id: 'lang-es',
      isActive: true,
    });
    prisma.character.findMany.mockResolvedValue([]);
    prisma.novel.findFirst.mockResolvedValue(null);
    prisma.novel.findUnique.mockResolvedValue(null);
    prisma.novel.create.mockResolvedValue(
      createNovelFixture({
        slug: 'my-title',
        authorId: 'author-id',
        author: { id: 'author-id', username: 'demo_writer', profile: null },
      }),
    );

    const result = await service.createNovel('author-id', {
      title: 'My Title',
      synopsis: 'Synopsis',
      status: NovelStatus.DRAFT,
      isPublic: false,
    });

    expect(prisma.novel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: 'my-title',
          author: { connect: { id: 'author-id' } },
        }),
      }),
    );
    expect(result.slug).toBe('my-title');
  });

  it('createNovel throws when trying to publish without chapters', async () => {
    prisma.genre.count.mockResolvedValue(0);
    prisma.catalogLanguage.findUnique.mockResolvedValue({
      id: 'lang-es',
      isActive: true,
    });
    prisma.character.findMany.mockResolvedValue([]);
    prisma.novel.findFirst.mockResolvedValue(null);

    await expect(
      service.createNovel('author-id', {
        title: 'Forbidden publish',
        isPublic: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('toggleLike deletes the like when it already exists', async () => {
    prisma.novel.findUnique.mockResolvedValue(
      createNovelFixture({ slug: 'fixture-novel', isPublic: true }),
    );
    prisma.novelLike.findUnique.mockResolvedValue({ id: 'like-id' });

    const result = await service.toggleLike('fixture-novel', 'viewer-id');

    expect(prisma.novelLike.delete).toHaveBeenCalledWith({
      where: { id: 'like-id' },
    });
    expect(result).toEqual({ hasLiked: false });
  });

  it('toggleLike creates milestone notification at 100 likes', async () => {
    prisma.novel.findUnique.mockResolvedValue(
      createNovelFixture({
        slug: 'fixture-novel',
        isPublic: true,
        authorId: 'author-id',
        title: 'Fixture Novel',
      }),
    );
    prisma.novelLike.findUnique.mockResolvedValue(null);
    prisma.novelLike.count.mockResolvedValue(100);

    await service.toggleLike('fixture-novel', 'viewer-id');

    expect(prisma.novelLike.create).toHaveBeenCalled();
    expect(notificationsService.createNotification).toHaveBeenCalled();
  });
});
