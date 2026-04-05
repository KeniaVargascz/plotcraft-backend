import { PrismaClient } from '@prisma/client';
import { runSeedStep } from './seed-step.util';

export async function seed09Characters(prisma: PrismaClient): Promise<void> {
  await runSeedStep(prisma, 'characters', async () => {});
}
