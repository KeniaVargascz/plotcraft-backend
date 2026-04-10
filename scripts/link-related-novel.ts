import { PrismaClient } from '@prisma/client';

async function main() {
  const p = new PrismaClient();
  try {
    const c = await p.community.findUnique({
      where: { slug: 'reino-de-test-user' },
    });
    const n = await p.novel.findUnique({
      where: { slug: 'ecos-del-test-user' },
    });
    if (!c) throw new Error('community missing');
    if (!n) throw new Error('novel missing');
    await p.communityRelatedNovel.upsert({
      where: {
        communityId_novelId: { communityId: c.id, novelId: n.id },
      },
      update: {},
      create: { communityId: c.id, novelId: n.id },
    });
    console.log('linked', n.slug, '→', c.slug);
  } catch (e) {
    console.error('FAILED:', e);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
}

main();
