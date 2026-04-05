import { PrismaClient } from '@prisma/client';
import { runSeedStep } from './seed-step.util';

export async function seed08Worlds(prisma: PrismaClient): Promise<void> {
  await runSeedStep(prisma, 'worlds', async () => {});
}
