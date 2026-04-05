import { PrismaClient } from '@prisma/client';
import { runSeedStep } from './seed-step.util';

export async function seed01Users(prisma: PrismaClient): Promise<void> {
  await runSeedStep(prisma, 'users', async () => {});
}
