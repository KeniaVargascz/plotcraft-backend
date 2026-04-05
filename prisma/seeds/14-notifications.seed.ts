import { PrismaClient } from '@prisma/client';
import { runSeedStep } from './seed-step.util';

export async function seed14Notifications(prisma: PrismaClient): Promise<void> {
  await runSeedStep(prisma, 'notifications', async () => {});
}
