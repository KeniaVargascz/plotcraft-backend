import { PrismaClient } from '@prisma/client';
(async () => {
  const p = new PrismaClient();
  const n = await p.novel.findUnique({
    where: { slug: 'la-cocina-del-amor' },
    include: {
      novelCharacters: { include: { communityCharacter: true, character: true } },
    },
  });
  console.log(JSON.stringify(n, null, 2));
  await p.$disconnect();
})();
