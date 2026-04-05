import { PrismaClient } from '@prisma/client';

export type SeedStep = {
  name: string;
  run: (prisma: PrismaClient) => Promise<void>;
};

export async function runSeedStep(
  prisma: PrismaClient,
  label: string,
  handler: (prisma: PrismaClient) => Promise<void>,
) {
  console.log(`  -> Seeding ${label}...`);
  await handler(prisma);
  console.log(`  ✓ ${label} seeded`);
}
