import { PrismaClient } from '@prisma/client';
import { runSeedStep } from './seed-step.util';

const GENRES = [
  { slug: 'fantasia', label: 'Fantasía' },
  { slug: 'ciencia-ficcion', label: 'Ciencia ficción' },
  { slug: 'romance', label: 'Romance' },
  { slug: 'terror', label: 'Terror' },
  { slug: 'misterio', label: 'Misterio' },
  { slug: 'aventura', label: 'Aventura' },
  { slug: 'drama', label: 'Drama' },
  { slug: 'thriller', label: 'Thriller' },
  { slug: 'historica', label: 'Histórica' },
  { slug: 'comedia', label: 'Comedia' },
  { slug: 'distopia', label: 'Distopía' },
  { slug: 'paranormal', label: 'Paranormal' },
  { slug: 'slice-of-life', label: 'Slice of Life' },
  { slug: 'accion', label: 'Acción' },
  { slug: 'suspenso', label: 'Suspenso' },
  { slug: 'magia', label: 'Magia' },
  { slug: 'urbana', label: 'Urbana' },
  { slug: 'epica', label: 'Épica' },
  { slug: 'dark-fantasy', label: 'Dark Fantasy' },
  { slug: 'isekai', label: 'Isekai' },
  { slug: 'litrpg', label: 'LitRPG' },
  { slug: 'steampunk', label: 'Steampunk' },
  { slug: 'cyberpunk', label: 'Cyberpunk' },
  { slug: 'policiaca', label: 'Policíaca' },
  { slug: 'psicologica', label: 'Psicológica' },
  { slug: 'poetica', label: 'Poética' },
  { slug: 'juvenil', label: 'Juvenil' },
  { slug: 'infantil', label: 'Infantil' },
  { slug: 'gore', label: 'Gore' },
  { slug: 'sobrenatural', label: 'Sobrenatural' },
];

export async function seed00Genres(prisma: PrismaClient): Promise<void> {
  await runSeedStep(prisma, 'genres', async () => {
    for (const genre of GENRES) {
      await prisma.genre.upsert({
        where: { slug: genre.slug },
        update: { label: genre.label },
        create: genre,
      });
    }
    console.log(`  → ${GENRES.length} géneros creados/actualizados`);
  });
}
