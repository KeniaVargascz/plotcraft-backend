import { ChaptersService } from '../../modules/chapters/chapters.service';
import {
  createChapterFixture,
  createNovelFixture,
} from '../helpers/fixtures.helper';

describe('ChaptersService', () => {
  const prisma = {
    chapter: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    follow: {
      findMany: jest.fn(),
    },
    notification: {
      createMany: jest.fn(),
    },
    novelSubscription: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const novelsService = {
    findOwnedNovel: jest.fn(),
    recalculateNovelWordCount: jest.fn(),
  } as any;

  const notificationsService = {
    createNotification: jest.fn(),
  } as any;

  let service: ChaptersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChaptersService(prisma, novelsService, notificationsService);
  });

  it('createChapter auto-assigns order = max + 1 and calculates word count', async () => {
    novelsService.findOwnedNovel.mockResolvedValue(createNovelFixture());
    prisma.chapter.aggregate.mockResolvedValue({ _max: { order: 4 } });
    prisma.chapter.findMany.mockResolvedValue([]);
    prisma.chapter.findFirst.mockResolvedValue(null);
    prisma.chapter.create.mockResolvedValue(
      createChapterFixture({ order: 5, wordCount: 9 }),
    );

    const result = await service.createChapter('fixture-novel', 'author-id', {
      title: 'Nuevo capitulo',
      content: 'Uno dos tres cuatro cinco seis siete ocho nueve',
    });

    expect(prisma.chapter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          order: 5,
          wordCount: 9,
        }),
      }),
    );
    expect(result.order).toBe(5);
  });

  it('publishChapter saves snapshot, recalculates word count and limits follower notifications to 100', async () => {
    const chapter = createChapterFixture({
      title: 'Capitulo Uno',
      content: 'Contenido suficiente para publicar el capitulo con exito.',
      novel: createNovelFixture({
        title: 'Fixture Novel',
        slug: 'fixture-novel',
      }),
    });
    novelsService.findOwnedNovel.mockResolvedValue(createNovelFixture());
    prisma.chapter.findFirst.mockResolvedValue(chapter);
    prisma.chapter.update.mockResolvedValue({
      ...chapter,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      novel: createNovelFixture({
        title: 'Fixture Novel',
        slug: 'fixture-novel',
      }),
    });
    prisma.follow.findMany.mockResolvedValue(
      Array.from({ length: 100 }, (_, index) => ({
        followerId: `user-${index}`,
      })),
    );
    prisma.notification.createMany.mockResolvedValue({ count: 100 });
    prisma.novelSubscription.findMany.mockResolvedValue([]);

    await service.publishChapter(
      'fixture-novel',
      'fixture-chapter',
      'author-id',
    );

    expect(prisma.follow.findMany).toHaveBeenCalled();
    expect(novelsService.recalculateNovelWordCount).toHaveBeenCalled();
    expect(prisma.notification.createMany).toHaveBeenCalled();
  });

  it('autosaveChapter returns minimal response and does not recalculate novel word count', async () => {
    prisma.chapter.findFirst.mockResolvedValue(createChapterFixture());
    prisma.chapter.update.mockResolvedValue({
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      wordCount: 7,
    });

    const result = await service.autosaveChapter(
      'fixture-novel',
      'fixture-chapter',
      'author-id',
      {
        content: 'Uno dos tres cuatro cinco seis siete',
      },
    );

    expect(result.wordCount).toBe(7);
    expect(novelsService.recalculateNovelWordCount).not.toHaveBeenCalled();
  });
});
