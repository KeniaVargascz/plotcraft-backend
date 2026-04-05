import { PrismaClient } from '@prisma/client';
import { runSeedStep } from './seed-step.util';

export async function seed07Social(prisma: PrismaClient): Promise<void> {
  await runSeedStep(prisma, 'social', async () => {});
}
