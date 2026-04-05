import { PrismaClient } from '@prisma/client';
import { runSeedStep } from './seed-step.util';

export async function seed10Worldbuilding(prisma: PrismaClient): Promise<void> {
  await runSeedStep(prisma, 'worldbuilding', async () => {});
}
