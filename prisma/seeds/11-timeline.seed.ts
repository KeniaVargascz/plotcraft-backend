import { PrismaClient } from '@prisma/client';
import { runSeedStep } from './seed-step.util';

export async function seed11Timeline(prisma: PrismaClient): Promise<void> {
  await runSeedStep(prisma, 'timeline', async () => {});
}
