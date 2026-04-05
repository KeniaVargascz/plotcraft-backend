import { PrismaClient } from '@prisma/client';
import { runSeedStep } from './seed-step.util';

export async function seed06ReaderData(prisma: PrismaClient): Promise<void> {
  await runSeedStep(prisma, 'reader-data', async () => {});
}
