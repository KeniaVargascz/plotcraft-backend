import { PrismaClient } from '@prisma/client';

async function main() {
  const p = new PrismaClient();
  try {
    const novel = await p.novel.findUnique({
      where: { slug: 'la-saga-del-reino' },
    });
    if (!novel) throw new Error('novel not found');
    const c = await p.community.update({
      where: { slug: 'reino-de-test-user' },
      data: { linkedNovelId: novel.id },
    });
    console.log({
      slug: c.slug,
      type: c.type,
      linkedNovelId: c.linkedNovelId,
    });
  } catch (e) {
    console.error('FAILED:', e);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
}

main();
