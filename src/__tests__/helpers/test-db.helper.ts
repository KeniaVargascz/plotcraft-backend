import { PrismaClient } from '@prisma/client';

export const testPrisma = new PrismaClient();

export async function cleanupUsersByPrefix(prefix: string) {
  const users = await testPrisma.user.findMany({
    where: {
      OR: [
        { email: { startsWith: prefix } },
        { username: { startsWith: prefix } },
      ],
    },
    select: { id: true },
  });

  if (!users.length) {
    return;
  }

  await testPrisma.user.deleteMany({
    where: { id: { in: users.map((user) => user.id) } },
  });
}

export async function disconnectTestDb() {
  await testPrisma.$disconnect();
}
