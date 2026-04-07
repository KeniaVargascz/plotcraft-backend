import { PrismaClient } from '@prisma/client';
import { runSeedStep } from './seed-step.util';

const LANGUAGES = [
  { code: 'es', name: 'Español', description: 'Español' },
  { code: 'en', name: 'Inglés', description: 'Inglés' },
  { code: 'pt', name: 'Portugués', description: 'Portugués' },
  { code: 'fr', name: 'Francés', description: 'Francés' },
  { code: 'de', name: 'Alemán', description: 'Alemán' },
  { code: 'it', name: 'Italiano', description: 'Italiano' },
  { code: 'ja', name: 'Japonés', description: 'Japonés' },
  { code: 'ko', name: 'Coreano', description: 'Coreano' },
  { code: 'zh', name: 'Chino', description: 'Chino' },
  { code: 'ru', name: 'Ruso', description: 'Ruso' },
  { code: 'ar', name: 'Árabe', description: 'Árabe' },
  { code: 'other', name: 'Otro', description: 'Otro' },
] as const;

export async function seed00Languages(prisma: PrismaClient): Promise<void> {
  await runSeedStep(prisma, 'languages', async () => {
    for (const language of LANGUAGES) {
      await prisma.catalogLanguage.upsert({
        where: { code: language.code },
        update: {
          name: language.name,
          description: language.description,
          isActive: true,
        },
        create: language,
      });
    }
  });
}
