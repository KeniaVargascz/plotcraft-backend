import {
  CommunityMemberRole,
  CommunityMemberStatus,
  CommunityStatus,
  CommunityType,
  PrismaClient,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { runSeedStep } from './seed-step.util';

export async function seed19Communities(prisma: PrismaClient): Promise<void> {
  await runSeedStep(prisma, 'communities', async () => {
    // 1. Admin user
    const passwordHash = await bcrypt.hash('Admin1234!', 12);
    await prisma.user.upsert({
      where: { email: 'admin@plotcraft.com' },
      update: { isAdmin: true },
      create: {
        email: 'admin@plotcraft.com',
        username: 'plotcraft_admin',
        passwordHash,
        isAdmin: true,
        isActive: true,
        profile: {
          create: { displayName: 'PlotCraft Admin', isPublic: true },
        },
      },
    });

    const demo = await prisma.user.findUnique({
      where: { username: 'demo_writer' },
    });
    const luna = await prisma.user.findUnique({
      where: { username: 'writer_luna' },
    });

    if (!demo || !luna) {
      console.log('    Skipping communities seed: required users not found');
      return;
    }

    const velNovel = await prisma.novel.findUnique({
      where: { slug: 'las-cronicas-del-velo' },
    });

    // 2. "El Velo" PRIVATE community owned by demo_writer
    let velo: { id: string; slug: string } | null = null;
    if (velNovel) {
      const community = await prisma.community.upsert({
        where: { slug: 'el-velo' },
        update: {},
        create: {
          ownerId: demo.id,
          name: 'El Velo',
          slug: 'el-velo',
          type: CommunityType.PRIVATE,
          status: CommunityStatus.ACTIVE,
          description:
            'Comunidad privada para los lectores de Las Cronicas del Velo.',
          linkedNovelId: velNovel.id,
        },
      });
      velo = { id: community.id, slug: community.slug };
    } else {
      console.log('    Skipping "El Velo" community: novel not found');
    }

    // 3. "Mundo Anime" FANDOM community owned by writer_luna
    const anime = await prisma.community.upsert({
      where: { slug: 'mundo-anime' },
      update: {},
      create: {
        ownerId: luna.id,
        name: 'Mundo Anime',
        slug: 'mundo-anime',
        type: CommunityType.FANDOM,
        status: CommunityStatus.ACTIVE,
        description: 'Comunidad fandom para fans del anime y el manga.',
      },
    });

    // 4. Memberships
    const memberships: Array<{
      communityId: string;
      userId: string;
      role: CommunityMemberRole;
    }> = [];

    if (velo) {
      memberships.push(
        {
          communityId: velo.id,
          userId: demo.id,
          role: CommunityMemberRole.ADMIN,
        },
        {
          communityId: velo.id,
          userId: luna.id,
          role: CommunityMemberRole.MEMBER,
        },
      );
    }

    memberships.push(
      {
        communityId: anime.id,
        userId: luna.id,
        role: CommunityMemberRole.ADMIN,
      },
      {
        communityId: anime.id,
        userId: demo.id,
        role: CommunityMemberRole.MEMBER,
      },
    );

    for (const m of memberships) {
      await prisma.communityMember.upsert({
        where: {
          communityId_userId: {
            communityId: m.communityId,
            userId: m.userId,
          },
        },
        update: { role: m.role, status: CommunityMemberStatus.ACTIVE },
        create: {
          communityId: m.communityId,
          userId: m.userId,
          role: m.role,
          status: CommunityMemberStatus.ACTIVE,
        },
      });
    }

    // 5. CommunityFollow: writer_luna follows "El Velo"
    if (velo) {
      await prisma.communityFollow.upsert({
        where: {
          communityId_userId: {
            communityId: velo.id,
            userId: luna.id,
          },
        },
        update: {},
        create: {
          communityId: velo.id,
          userId: luna.id,
        },
      });
    }

    // 6. Recompute counts
    const allCommunities = await prisma.community.findMany({
      select: { id: true },
    });
    for (const c of allCommunities) {
      const [members, followers] = await Promise.all([
        prisma.communityMember.count({
          where: {
            communityId: c.id,
            status: CommunityMemberStatus.ACTIVE,
          },
        }),
        prisma.communityFollow.count({ where: { communityId: c.id } }),
      ]);
      await prisma.community.update({
        where: { id: c.id },
        data: { membersCount: members, followersCount: followers },
      });
    }
  });
}
