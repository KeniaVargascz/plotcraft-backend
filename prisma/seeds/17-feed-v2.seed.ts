import { PrismaClient } from '@prisma/client';
import { runSeedStep } from './seed-step.util';

export async function seed17FeedV2(prisma: PrismaClient): Promise<void> {
  await runSeedStep(prisma, 'feed-v2 (tags, kudos)', async () => {
    // Find existing users
    const demo = await prisma.user.findUnique({
      where: { email: 'demo@plotcraft.com' },
    });
    const luna = await prisma.user.findUnique({
      where: { email: 'luna@plotcraft.com' },
    });
    const marcos = await prisma.user.findUnique({
      where: { email: 'writer.marcos@plotcraft.com' },
    });
    const alex = await prisma.user.findUnique({
      where: { email: 'reader.alex@plotcraft.com' },
    });

    if (!demo || !luna || !marcos || !alex) {
      console.log('    Skipping feed-v2 seed: required users not found');
      return;
    }

    // Update some existing posts with imageUrls and tags
    const posts = await prisma.post.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
    });

    const tagSets = [
      ['escritura', 'fantasia', 'worldbuilding'],
      ['personajes', 'desarrollo'],
      ['inspiracion', 'tips-de-escritura'],
      ['ciencia-ficcion', 'novela'],
      ['proceso-creativo'],
      ['actualizacion', 'progreso'],
    ];

    for (let i = 0; i < posts.length; i++) {
      await prisma.post.update({
        where: { id: posts[i].id },
        data: {
          tags: tagSets[i] ?? [],
          imageUrls:
            i % 3 === 0 ? ['https://picsum.photos/seed/plotcraft/800/400'] : [],
        },
      });
    }

    // Find existing novels for kudos
    const novels = await prisma.novel.findMany({
      where: { isPublic: true },
      take: 3,
    });

    // Create kudos with upsert logic
    for (const novel of novels) {
      const kudoUsers = [demo, luna, marcos, alex].filter(
        (u) => u.id !== novel.authorId,
      );

      for (const user of kudoUsers.slice(0, 2)) {
        await prisma.novelKudo.upsert({
          where: {
            novelId_userId: { novelId: novel.id, userId: user.id },
          },
          update: {},
          create: {
            novelId: novel.id,
            userId: user.id,
          },
        });
      }

      // Update kudos count
      const kudosCount = await prisma.novelKudo.count({
        where: { novelId: novel.id },
      });
      await prisma.novel.update({
        where: { id: novel.id },
        data: { kudosCount },
      });
    }
  });
}
