import { PrismaClient } from '@prisma/client';
(async () => {
  const p = new PrismaClient();
  const c = await p.community.findUnique({ where: { slug: 'fandom-one-piece' } });
  console.log('community:', c);
  if (c) {
    const chars = await p.communityCharacter.findMany({ where: { communityId: c.id } });
    console.log('chars count:', chars.length);
    console.log(chars.map((x) => `${x.name} :: ${x.status}`));
  }
  await p.$disconnect();
})();
