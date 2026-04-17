import { PrismaClient, SeriesStatus, SeriesType } from '@prisma/client';
import { runSeedStep } from './seed-step.util';

export async function seed18SeriesSubscriptions(
  prisma: PrismaClient,
): Promise<void> {
  await runSeedStep(prisma, 'series + subscriptions', async () => {
    // 1. Ensure every novel has aggregated totals
    const novels = await prisma.novel.findMany({
      include: {
        chapters: {
          where: { status: 'PUBLISHED' },
          select: { wordCount: true },
        },
      },
    });

    for (const novel of novels) {
      const total = novel.chapters.reduce(
        (sum, c) => sum + (c.wordCount ?? 0),
        0,
      );
      await prisma.novel.update({
        where: { id: novel.id },
        data: {
          totalWordsCount: total,
          chaptersCount: novel.chapters.length,
        },
      });
    }

    // 2. Create a trilogy for demo_writer
    const demo = await prisma.user.findUnique({
      where: { email: 'demo@plotcraft.com' },
    });
    if (!demo) {
      console.log('    Skipping series seed: demo user not found');
      return;
    }

    const series = await prisma.series.upsert({
      where: { slug: 'cronicas-del-velo' },
      create: {
        authorId: demo.id,
        title: 'Cronicas del Velo',
        slug: 'cronicas-del-velo',
        description:
          'Una trilogia oscura sobre el mundo donde vivos y muertos coexisten.',
        type: SeriesType.TRILOGY,
        status: SeriesStatus.IN_PROGRESS,
      },
      update: {},
    });

    // 3. Link up to 3 of demo's novels
    const demoNovels = await prisma.novel.findMany({
      where: { authorId: demo.id },
      orderBy: { createdAt: 'asc' },
      take: 3,
    });

    for (let i = 0; i < demoNovels.length; i++) {
      await prisma.seriesNovel.upsert({
        where: {
          seriesId_novelId: {
            seriesId: series.id,
            novelId: demoNovels[i].id,
          },
        },
        create: {
          seriesId: series.id,
          novelId: demoNovels[i].id,
          orderIndex: i + 1,
        },
        update: { orderIndex: i + 1 },
      });
    }

    // 4. Subscribe writer_luna to first novel of demo_writer
    const luna = await prisma.user.findUnique({
      where: { email: 'luna@plotcraft.com' },
    });

    if (luna && demoNovels[0]) {
      const existing = await prisma.novelSubscription.findUnique({
        where: {
          novelId_userId: {
            novelId: demoNovels[0].id,
            userId: luna.id,
          },
        },
      });
      if (!existing) {
        await prisma.novelSubscription.create({
          data: { novelId: demoNovels[0].id, userId: luna.id },
        });
        await prisma.novel.update({
          where: { id: demoNovels[0].id },
          data: { subscribersCount: { increment: 1 } },
        });
      }
    }
  });
}
