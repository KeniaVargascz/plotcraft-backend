import { PrismaClient } from '@prisma/client';
import { CANONICAL_GENRES } from '../../src/modules/genres/genre-catalog';
import { runSeedStep } from './seed-step.util';

export async function seed00Genres(prisma: PrismaClient): Promise<void> {
  await runSeedStep(prisma, 'genres', async () => {
    for (const genre of CANONICAL_GENRES) {
      await prisma.genre.upsert({
        where: { slug: genre.slug },
        update: { label: genre.label },
        create: { slug: genre.slug, label: genre.label },
      });
    }

    console.log(`  -> ${CANONICAL_GENRES.length} generos canonicos creados/actualizados`);
  });
}
