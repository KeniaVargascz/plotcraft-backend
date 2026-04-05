import { PrismaClient } from '@prisma/client';
import { runSeedStep } from './seed-step.util';

export async function seed04Novels(prisma: PrismaClient): Promise<void> {
  await runSeedStep(prisma, 'novels', async () => {});
}
