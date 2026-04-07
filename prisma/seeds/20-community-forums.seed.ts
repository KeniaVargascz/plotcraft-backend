import {
  CommunityMemberRole,
  CommunityMemberStatus,
  CommunityStatus,
  CommunityType,
  ForumCategory,
  PrismaClient,
  ThreadStatus,
} from '@prisma/client';
import { runSeedStep } from './seed-step.util';

const PLOTCRAFT_FORUMS: Array<{
  category: ForumCategory;
  name: string;
  slug: string;
  description: string;
}> = [
  {
    category: ForumCategory.GENERAL,
    name: 'General',
    slug: 'general',
    description: 'Discusiones generales sobre PlotCraft.',
  },
  {
    category: ForumCategory.FEEDBACK,
    name: 'Feedback',
    slug: 'feedback',
    description: 'Comparte tus ideas y sugerencias.',
  },
  {
    category: ForumCategory.WRITING_TIPS,
    name: 'Consejos de escritura',
    slug: 'consejos-de-escritura',
    description: 'Tips, técnicas y recursos para escritores.',
  },
  {
    category: ForumCategory.WORLD_BUILDING,
    name: 'World-building',
    slug: 'world-building',
    description: 'Construcción de mundos ficticios.',
  },
  {
    category: ForumCategory.CHARACTERS,
    name: 'Personajes',
    slug: 'personajes',
    description: 'Diseño y desarrollo de personajes.',
  },
  {
    category: ForumCategory.SHOWCASE,
    name: 'Showcase',
    slug: 'showcase',
    description: 'Muestra tu trabajo a la comunidad.',
  },
  {
    category: ForumCategory.ANNOUNCEMENTS,
    name: 'Anuncios',
    slug: 'anuncios',
    description: 'Anuncios oficiales de PlotCraft.',
  },
  {
    category: ForumCategory.HELP,
    name: 'Ayuda',
    slug: 'ayuda',
    description: 'Pide ayuda a la comunidad.',
  },
  {
    category: ForumCategory.OFF_TOPIC,
    name: 'Fuera de tema',
    slug: 'fuera-de-tema',
    description: 'Cualquier otro tema.',
  },
];

export async function seed20CommunityForums(prisma: PrismaClient): Promise<void> {
  await runSeedStep(prisma, 'community-forums', async () => {
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@plotcraft.com' },
    });
    if (!admin) {
      console.log('    Skipping community-forums seed: admin not found');
      return;
    }

    // 1. PlotCraft Community (system community)
    const plotcraftCommunity = await prisma.community.upsert({
      where: { slug: 'plotcraft-community' },
      update: { status: CommunityStatus.ACTIVE },
      create: {
        ownerId: admin.id,
        name: 'PlotCraft Community',
        slug: 'plotcraft-community',
        type: CommunityType.FANDOM,
        status: CommunityStatus.ACTIVE,
        description:
          'Comunidad oficial de PlotCraft. Aquí viven los foros globales de la plataforma.',
      },
    });

    // ensure admin is a member with ADMIN role
    await prisma.communityMember.upsert({
      where: {
        communityId_userId: {
          communityId: plotcraftCommunity.id,
          userId: admin.id,
        },
      },
      update: {
        role: CommunityMemberRole.ADMIN,
        status: CommunityMemberStatus.ACTIVE,
      },
      create: {
        communityId: plotcraftCommunity.id,
        userId: admin.id,
        role: CommunityMemberRole.ADMIN,
        status: CommunityMemberStatus.ACTIVE,
      },
    });

    // 2. One forum per ForumCategory
    const forumByCategory = new Map<ForumCategory, string>();
    for (const def of PLOTCRAFT_FORUMS) {
      const forum = await prisma.communityForum.upsert({
        where: {
          communityId_slug: {
            communityId: plotcraftCommunity.id,
            slug: def.slug,
          },
        },
        update: { name: def.name, description: def.description },
        create: {
          communityId: plotcraftCommunity.id,
          name: def.name,
          slug: def.slug,
          description: def.description,
          isPublic: true,
        },
      });
      forumByCategory.set(def.category, forum.id);
    }

    // 3. Backfill legacy ForumThread.forumId by category
    for (const [category, forumId] of forumByCategory.entries()) {
      await prisma.forumThread.updateMany({
        where: { category, forumId: null },
        data: { forumId },
      });
    }

    // 4. "Teorías del Velo" forum + thread + member in "El Velo"
    const velo = await prisma.community.findUnique({
      where: { slug: 'el-velo' },
    });
    if (velo) {
      const veloOwner = await prisma.user.findUnique({
        where: { id: velo.ownerId },
      });
      const teorias = await prisma.communityForum.upsert({
        where: {
          communityId_slug: {
            communityId: velo.id,
            slug: 'teorias-del-velo',
          },
        },
        update: {},
        create: {
          communityId: velo.id,
          name: 'Teorías del Velo',
          slug: 'teorias-del-velo',
          description:
            'Discute teorías sobre Las Crónicas del Velo.',
          isPublic: false,
        },
      });

      if (veloOwner) {
        // create owner ForumMember
        await prisma.forumMember.upsert({
          where: {
            forumId_userId: {
              forumId: teorias.id,
              userId: veloOwner.id,
            },
          },
          update: {},
          create: { forumId: teorias.id, userId: veloOwner.id },
        });

        // initial thread
        const existingThread = await prisma.forumThread.findUnique({
          where: { slug: 'que-esconde-el-velo' },
        });
        if (!existingThread) {
          await prisma.forumThread.create({
            data: {
              authorId: veloOwner.id,
              forumId: teorias.id,
              title: '¿Qué esconde el Velo?',
              slug: 'que-esconde-el-velo',
              content:
                'Comparte tus teorías sobre lo que realmente oculta el Velo en las crónicas.',
              status: ThreadStatus.OPEN,
            },
          });
        }
      }
    }

    // 5. Backfill threadsCount and membersCount accurately
    const allForums = await prisma.communityForum.findMany({
      select: { id: true },
    });
    for (const f of allForums) {
      const [threads, members] = await Promise.all([
        prisma.forumThread.count({
          where: { forumId: f.id, deletedAt: null },
        }),
        prisma.forumMember.count({ where: { forumId: f.id } }),
      ]);
      await prisma.communityForum.update({
        where: { id: f.id },
        data: { threadsCount: threads, membersCount: members },
      });
    }

    // Backfill repliesCount/reactionsCount on threads
    const threads = await prisma.forumThread.findMany({
      select: { id: true },
    });
    for (const t of threads) {
      const [replies, reactions] = await Promise.all([
        prisma.forumReply.count({
          where: { threadId: t.id, deletedAt: null },
        }),
        prisma.forumReaction.count({ where: { threadId: t.id } }),
      ]);
      await prisma.forumThread.update({
        where: { id: t.id },
        data: { repliesCount: replies, reactionsCount: reactions },
      });
    }
  });
}
