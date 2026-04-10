import { PrismaClient } from '@prisma/client';
(async () => {
  const p = new PrismaClient();
  const n = await p.novel.findUnique({
    where: { slug: 'la-cocina-del-amor' },
    include: { chapters: true },
  });
  console.log('chapters:', n?.chapters);
  await p.$disconnect();
})();
