import { NovelStatus, NovelType, PrismaClient } from '@prisma/client';

async function main() {
  const p = new PrismaClient();
  try {
    const u = await p.user.findUnique({ where: { username: 'test_user' } });
    if (!u) throw new Error('test_user not found');
    const lang = await p.catalogLanguage.findUnique({ where: { code: 'es' } });
    if (!lang) throw new Error('language es missing');

    const novel = await p.novel.upsert({
      where: { slug: 'ecos-del-test-user' },
      update: {
        novelType: NovelType.ORIGINAL,
        linkedCommunityId: null,
        authorId: u.id,
      },
      create: {
        title: 'Ecos del Test User',
        slug: 'ecos-del-test-user',
        synopsis: 'Novela original de test_user, sin vínculo a comunidad fandom.',
        status: NovelStatus.IN_PROGRESS,
        novelType: NovelType.ORIGINAL,
        languageId: lang.id,
        authorId: u.id,
        tags: ['demo'],
        isPublic: false,
      },
    });
    console.log('OK:', novel.slug, novel.novelType);
  } catch (e) {
    console.error('FAILED:', e);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
}

main();
