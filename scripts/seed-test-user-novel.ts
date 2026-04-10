import {
  CommunityMemberRole,
  CommunityMemberStatus,
  CommunityStatus,
  CommunityType,
  NovelStatus,
  NovelType,
  PrismaClient,
} from '@prisma/client';

async function main() {
  const p = new PrismaClient();
  try {
    const u = await p.user.findUnique({ where: { username: 'test_user' } });
    if (!u) throw new Error('test_user not found');

    const community = await p.community.upsert({
      where: { slug: 'reino-de-test-user' },
      update: { ownerId: u.id, status: CommunityStatus.ACTIVE },
      create: {
        ownerId: u.id,
        name: 'Reino de Test User',
        slug: 'reino-de-test-user',
        type: CommunityType.FANDOM,
        status: CommunityStatus.ACTIVE,
        description:
          'Comunidad fandom creada por test_user para su saga propia.',
      },
    });

    await p.communityMember.upsert({
      where: {
        communityId_userId: { communityId: community.id, userId: u.id },
      },
      update: {
        role: CommunityMemberRole.ADMIN,
        status: CommunityMemberStatus.ACTIVE,
      },
      create: {
        communityId: community.id,
        userId: u.id,
        role: CommunityMemberRole.ADMIN,
        status: CommunityMemberStatus.ACTIVE,
      },
    });

    const lang = await p.catalogLanguage.findUnique({ where: { code: 'es' } });
    if (!lang) throw new Error('language es missing');
    const fanfictionGenre = await p.genre.findUnique({
      where: { slug: 'fanfiction' },
    });

    const novel = await p.novel.upsert({
      where: { slug: 'la-saga-del-reino' },
      update: {
        novelType: NovelType.FANFIC,
        linkedCommunityId: community.id,
        authorId: u.id,
      },
      create: {
        title: 'La Saga del Reino',
        slug: 'la-saga-del-reino',
        synopsis:
          'Novela de test_user ambientada en su propio fandom Reino de Test User.',
        status: NovelStatus.IN_PROGRESS,
        novelType: NovelType.FANFIC,
        linkedCommunityId: community.id,
        languageId: lang.id,
        authorId: u.id,
        tags: ['fanfic', 'demo'],
        isPublic: false,
      },
    });

    if (fanfictionGenre) {
      await p.novelGenre.upsert({
        where: {
          novelId_genreId: { novelId: novel.id, genreId: fanfictionGenre.id },
        },
        update: {},
        create: { novelId: novel.id, genreId: fanfictionGenre.id },
      });
    }

    await p.community.update({
      where: { id: community.id },
      data: { membersCount: 1 },
    });

    console.log('OK community:', community.slug);
    console.log('OK novel:', novel.slug, '→ linkedCommunityId:', novel.linkedCommunityId);
  } catch (e) {
    console.error('FAILED:', e);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
}

main();
