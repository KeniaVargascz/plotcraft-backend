import { PrismaClient } from '@prisma/client';
import { runSeedStep } from './seed-step.util';

export async function seed13Forum(prisma: PrismaClient): Promise<void> {
  await runSeedStep(prisma, 'forum', async () => {});
}
