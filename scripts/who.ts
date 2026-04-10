import { PrismaClient } from '@prisma/client';
(async () => {
  const p = new PrismaClient();
  const u = await p.user.findUnique({ where: { id: '1177f764-4b58-4339-bd7f-85b6c4e059ee' } });
  console.log(u?.username, u?.email);
  await p.$disconnect();
})();
