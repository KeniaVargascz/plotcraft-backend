import { PrismaClient } from '@prisma/client';
import { runSeedStep } from './seed-step.util';

export async function seed15Maps(prisma: PrismaClient): Promise<void> {
  await runSeedStep(prisma, 'maps', async () => {});
}
