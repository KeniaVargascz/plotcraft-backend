import { PrismaClient } from '@prisma/client';
import { runSeedStep } from './seed-step.util';
import { main as seedLegacyData } from './legacy.seed';

export async function seed16Analytics(prisma: PrismaClient): Promise<void> {
  await runSeedStep(prisma, 'analytics-and-legacy-data', async () => {
    await seedLegacyData();
  });
}
