import { PrismaClient } from '@prisma/client';
import { runSeedStep } from './seed-step.util';

export async function seed23VisualBoards(prisma: PrismaClient): Promise<void> {
  await runSeedStep(prisma, 'visual boards', async () => {
    const demo = await prisma.user.findUnique({
      where: { email: 'demo@plotcraft.com' },
    });

    if (!demo) {
      console.log('    Skipping visual boards seed: demo user not found');
      return;
    }

    const novel = await prisma.novel.findFirst({
      where: { authorId: demo.id },
      orderBy: { createdAt: 'asc' },
    });

    if (!novel) {
      console.log('    Skipping visual boards seed: demo novel not found');
      return;
    }

    const board = await prisma.visualBoard.upsert({
      where: { id: '34f3d7d2-b5f3-4b89-8cb6-7f69f16dfc55' },
      create: {
        id: '34f3d7d2-b5f3-4b89-8cb6-7f69f16dfc55',
        authorId: demo.id,
        title: 'Referencias: Las Cronicas del Velo',
        isPublic: true,
        linkedType: 'novel',
        linkedId: novel.id,
      },
      update: {
        authorId: demo.id,
        title: 'Referencias: Las Cronicas del Velo',
        isPublic: true,
        linkedType: 'novel',
        linkedId: novel.id,
      },
    });

    const sections = [
      {
        id: 'da58a795-bd3c-4df8-a5f8-1cf116adc3ab',
        title: 'Paleta de colores',
        orderIndex: 1,
      },
      {
        id: '354a352a-8d48-4810-aaad-d1d6ae2fe7e9',
        title: 'Referencias de personajes',
        orderIndex: 2,
      },
    ];

    for (const section of sections) {
      await prisma.visualBoardSection.upsert({
        where: { id: section.id },
        create: {
          id: section.id,
          boardId: board.id,
          title: section.title,
          orderIndex: section.orderIndex,
        },
        update: {
          boardId: board.id,
          title: section.title,
          orderIndex: section.orderIndex,
        },
      });
    }
  });
}
