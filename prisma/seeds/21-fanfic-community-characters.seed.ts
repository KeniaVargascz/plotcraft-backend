import {
  CharacterRole,
  CommunityCharacterStatus,
  NovelStatus,
  NovelType,
  PrismaClient,
} from '@prisma/client';
import { runSeedStep } from './seed-step.util';

export async function seed21FanficCommunityCharacters(
  prisma: PrismaClient,
): Promise<void> {
  await runSeedStep(prisma, 'fanfic + community characters', async () => {
    const community = await prisma.community.findUnique({
      where: { slug: 'mundo-anime' },
    });
    const luna = await prisma.user.findUnique({
      where: { username: 'writer_luna' },
    });
    const demo = await prisma.user.findUnique({
      where: { username: 'demo_writer' },
    });

    if (!community || !luna) {
      console.log('    Skipping: required community or user not found.');
      return;
    }

    // 1. Three ACTIVE community characters (idempotent by name+communityId)
    const activeChars = [
      {
        name: 'Sakura Hana',
        description:
          'Protagonista de la serie. Estudiante de secundaria con poderes ocultos.',
      },
      {
        name: 'Kuro Tenshi',
        description: 'Antagonista misterioso con motivaciones ambiguas.',
      },
      {
        name: 'Sensei Hiroshi',
        description: 'Mentor del grupo. Conoce más secretos de los que revela.',
      },
    ];

    const created: Record<string, { id: string }> = {};
    for (const c of activeChars) {
      const existing = await prisma.communityCharacter.findFirst({
        where: { communityId: community.id, name: c.name },
      });
      const cc = existing
        ? await prisma.communityCharacter.update({
            where: { id: existing.id },
            data: {
              description: c.description,
              status: CommunityCharacterStatus.ACTIVE,
              suggestedById: null,
            },
          })
        : await prisma.communityCharacter.create({
            data: {
              communityId: community.id,
              name: c.name,
              description: c.description,
              status: CommunityCharacterStatus.ACTIVE,
            },
          });
      created[c.name] = { id: cc.id };
    }

    // 1b. One SUGGESTED character by demo_writer
    if (demo) {
      const suggestedName = 'Sanji Kuroashi';
      const existingSuggested = await prisma.communityCharacter.findFirst({
        where: { communityId: community.id, name: suggestedName },
      });
      if (!existingSuggested) {
        await prisma.communityCharacter.create({
          data: {
            communityId: community.id,
            name: suggestedName,
            description: 'Sugerencia pendiente: cocinero del equipo.',
            status: CommunityCharacterStatus.SUGGESTED,
            suggestedById: demo.id,
          },
        });
      }
    }

    // 2. FANFIC novel "Sakura y el Abismo"
    const language = await prisma.catalogLanguage.findUnique({
      where: { code: 'es' },
    });
    if (!language) {
      console.log('    Skipping fanfic novel: no es language');
      return;
    }

    const novel = await prisma.novel.upsert({
      where: { slug: 'sakura-y-el-abismo' },
      update: {
        novelType: NovelType.FANFIC,
        linkedCommunityId: community.id,
      },
      create: {
        title: 'Sakura y el Abismo',
        slug: 'sakura-y-el-abismo',
        synopsis:
          'Una historia alternativa donde Sakura descubre la verdad sobre su origen.',
        status: NovelStatus.IN_PROGRESS,
        novelType: NovelType.FANFIC,
        linkedCommunityId: community.id,
        languageId: language.id,
        authorId: luna.id,
        tags: ['fanfic', 'fantasia'],
      },
    });

    // 3. Backfill all other novels to ORIGINAL (idempotent)
    await prisma.novel.updateMany({
      where: {
        novelType: { not: NovelType.FANFIC },
      },
      data: { novelType: NovelType.ORIGINAL },
    });

    // 4. Link two community characters to the FANFIC novel via NovelCharacter
    const links: Array<{ name: string; role: CharacterRole }> = [
      { name: 'Sakura Hana', role: CharacterRole.PROTAGONIST },
      { name: 'Kuro Tenshi', role: CharacterRole.ANTAGONIST },
    ];

    for (const link of links) {
      const cc = created[link.name];
      if (!cc) continue;
      const existing = await prisma.novelCharacter.findUnique({
        where: {
          novelId_communityCharacterId: {
            novelId: novel.id,
            communityCharacterId: cc.id,
          },
        },
      });
      if (!existing) {
        await prisma.novelCharacter.create({
          data: {
            novelId: novel.id,
            communityCharacterId: cc.id,
            roleInNovel: link.role,
          },
        });
      }
    }
  });
}
