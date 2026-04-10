import {
  CharacterRole,
  CommunityCharacterStatus,
  CommunityMemberRole,
  CommunityMemberStatus,
  CommunityStatus,
  CommunityType,
  NovelStatus,
  NovelType,
  PrismaClient,
} from '@prisma/client';
import { runSeedStep } from './seed-step.util';

/**
 * E17 demo data tied to `test_user`. Idempotent.
 * If no FANDOM community exists, creates one ("Mundo Anime") owned by test_user.
 * Skips silently if test_user does not exist.
 */
export async function seed22TestUserFanfic(
  prisma: PrismaClient,
): Promise<void> {
  await runSeedStep(prisma, 'test_user fanfic demo data', async () => {
    const user = await prisma.user.findUnique({
      where: { username: 'test_user' },
    });
    if (!user) {
      console.log('    Skipping: test_user not found.');
      return;
    }

    // 1. Find or create a FANDOM community
    let fandom = await prisma.community.findFirst({
      where: { type: CommunityType.FANDOM, status: CommunityStatus.ACTIVE },
    });
    if (!fandom) {
      fandom = await prisma.community.create({
        data: {
          ownerId: user.id,
          name: 'Mundo Anime',
          slug: 'mundo-anime',
          type: CommunityType.FANDOM,
          status: CommunityStatus.ACTIVE,
          description: 'Comunidad fandom para fans del anime y el manga.',
        },
      });
    }

    // 2. test_user as ACTIVE member
    await prisma.communityMember.upsert({
      where: {
        communityId_userId: { communityId: fandom.id, userId: user.id },
      },
      update: { status: CommunityMemberStatus.ACTIVE },
      create: {
        communityId: fandom.id,
        userId: user.id,
        role:
          fandom.ownerId === user.id
            ? CommunityMemberRole.ADMIN
            : CommunityMemberRole.MEMBER,
        status: CommunityMemberStatus.ACTIVE,
      },
    });

    // 3. Ensure 3 ACTIVE community characters exist in this fandom
    const baseChars = [
      {
        name: 'Sakura Hana',
        description:
          'Protagonista canon. Estudiante de secundaria con poderes ocultos.',
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
    const activeIds: Record<string, string> = {};
    for (const c of baseChars) {
      const existing = await prisma.communityCharacter.findFirst({
        where: { communityId: fandom.id, name: c.name },
      });
      const cc = existing
        ? await prisma.communityCharacter.update({
            where: { id: existing.id },
            data: {
              description: c.description,
              status: CommunityCharacterStatus.ACTIVE,
            },
          })
        : await prisma.communityCharacter.create({
            data: {
              communityId: fandom.id,
              name: c.name,
              description: c.description,
              status: CommunityCharacterStatus.ACTIVE,
            },
          });
      activeIds[c.name] = cc.id;
    }

    // 4. SUGGESTED character authored by test_user
    const suggestedName = 'Aoi Mizuki';
    const existingSuggested = await prisma.communityCharacter.findFirst({
      where: { communityId: fandom.id, name: suggestedName },
    });
    if (!existingSuggested) {
      await prisma.communityCharacter.create({
        data: {
          communityId: fandom.id,
          name: suggestedName,
          description:
            'Sugerencia de test_user: estudiante transferida con un secreto.',
          status: CommunityCharacterStatus.SUGGESTED,
          suggestedById: user.id,
        },
      });
    }

    // 5. FANFIC novel by test_user linked to the fandom
    const language = await prisma.catalogLanguage.findUnique({
      where: { code: 'es' },
    });
    if (!language) return;

    const novel = await prisma.novel.upsert({
      where: { slug: 'cronicas-del-test-user' },
      update: {
        novelType: NovelType.FANFIC,
        linkedCommunityId: fandom.id,
      },
      create: {
        title: 'Crónicas del Test User',
        slug: 'cronicas-del-test-user',
        synopsis:
          'Fanfic de prueba: una saga paralela ambientada en el universo del fandom.',
        status: NovelStatus.IN_PROGRESS,
        novelType: NovelType.FANFIC,
        linkedCommunityId: fandom.id,
        languageId: language.id,
        authorId: user.id,
        tags: ['fanfic', 'demo'],
      },
    });

    // 6. Link Sakura Hana as PROTAGONIST in the novel
    const sakuraId = activeIds['Sakura Hana'];
    if (sakuraId) {
      const existingLink = await prisma.novelCharacter.findUnique({
        where: {
          novelId_communityCharacterId: {
            novelId: novel.id,
            communityCharacterId: sakuraId,
          },
        },
      });
      if (!existingLink) {
        await prisma.novelCharacter.create({
          data: {
            novelId: novel.id,
            communityCharacterId: sakuraId,
            roleInNovel: CharacterRole.PROTAGONIST,
          },
        });
      }
    }
  });
}
