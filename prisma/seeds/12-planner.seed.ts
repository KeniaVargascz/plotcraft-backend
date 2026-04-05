import { PrismaClient } from '@prisma/client';
import { runSeedStep } from './seed-step.util';

export async function seed12Planner(prisma: PrismaClient): Promise<void> {
  await runSeedStep(prisma, 'planner', async () => {});
}
