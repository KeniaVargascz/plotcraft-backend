import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CommunityMemberStatus,
  CommunityStatus,
  CommunityType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CommunitiesService } from './communities.service';

@Injectable()
export class CommunityMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communitiesService: CommunitiesService,
  ) {}

  async join(slug: string, userId: string) {
    const community = await this.prisma.community.findUnique({
      where: { slug },
      include: { owner: { select: { username: true } } },
    });
    if (!community) throw new NotFoundException('Comunidad no encontrada');
    if (community.status !== CommunityStatus.ACTIVE) {
      throw new UnprocessableEntityException(
        'Esta comunidad no esta activa.',
      );
    }
    if (community.ownerId === userId) {
      throw new ConflictException('Ya eres el creador de esta comunidad.');
    }

    const existing = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: { communityId: community.id, userId },
      },
    });
    if (existing && existing.status === CommunityMemberStatus.ACTIVE) {
      throw new ConflictException('Ya eres miembro de esta comunidad.');
    }

    if (community.type === CommunityType.PRIVATE) {
      const follows = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: userId,
            followingId: community.ownerId,
          },
        },
      });
      if (!follows) {
        throw new ForbiddenException(
          `Solo los seguidores de @${community.owner.username} pueden unirse a esta comunidad.`,
        );
      }
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.communityMember.upsert({
        where: {
          communityId_userId: { communityId: community.id, userId },
        },
        create: {
          communityId: community.id,
          userId,
          status: CommunityMemberStatus.ACTIVE,
        },
        update: { status: CommunityMemberStatus.ACTIVE },
      }),
      this.prisma.community.update({
        where: { id: community.id },
        data: { membersCount: { increment: 1 } },
      }),
    ]);

    return { membersCount: updated.membersCount, isMember: true };
  }

  async leave(slug: string, userId: string) {
    const community = await this.prisma.community.findUnique({
      where: { slug },
    });
    if (!community) throw new NotFoundException('Comunidad no encontrada');
    if (community.ownerId === userId) {
      throw new UnprocessableEntityException(
        'El creador no puede abandonar su propia comunidad.',
      );
    }

    const member = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: { communityId: community.id, userId },
      },
    });
    if (!member) throw new NotFoundException('No eres miembro de esta comunidad');

    const [, updated] = await this.prisma.$transaction([
      this.prisma.communityMember.delete({
        where: {
          communityId_userId: { communityId: community.id, userId },
        },
      }),
      this.prisma.community.update({
        where: { id: community.id },
        data: { membersCount: { decrement: 1 } },
      }),
    ]);

    return { membersCount: updated.membersCount, isMember: false };
  }

  async getMembers(slug: string, cursor?: string, limit = 20) {
    const community = await this.prisma.community.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!community) throw new NotFoundException('Comunidad no encontrada');

    const rows = await this.prisma.communityMember.findMany({
      where: {
        communityId: community.id,
        status: CommunityMemberStatus.ACTIVE,
      },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { joinedAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profile: {
              select: { displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    return {
      data: items.map((m) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        user: {
          id: m.user.id,
          username: m.user.username,
          displayName: m.user.profile?.displayName ?? m.user.username,
          avatarUrl: m.user.profile?.avatarUrl ?? null,
        },
      })),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  async follow(slug: string, userId: string) {
    const community = await this.prisma.community.findUnique({
      where: { slug },
    });
    if (!community) throw new NotFoundException('Comunidad no encontrada');
    if (community.status !== CommunityStatus.ACTIVE) {
      throw new UnprocessableEntityException(
        'Esta comunidad no esta activa.',
      );
    }

    const existing = await this.prisma.communityFollow.findUnique({
      where: {
        communityId_userId: { communityId: community.id, userId },
      },
    });
    if (existing) {
      throw new ConflictException('Ya sigues esta comunidad.');
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.communityFollow.create({
        data: { communityId: community.id, userId },
      }),
      this.prisma.community.update({
        where: { id: community.id },
        data: { followersCount: { increment: 1 } },
      }),
    ]);

    return { followersCount: updated.followersCount, isFollowing: true };
  }

  async unfollow(slug: string, userId: string) {
    const community = await this.prisma.community.findUnique({
      where: { slug },
    });
    if (!community) throw new NotFoundException('Comunidad no encontrada');

    const existing = await this.prisma.communityFollow.findUnique({
      where: {
        communityId_userId: { communityId: community.id, userId },
      },
    });
    if (!existing) {
      throw new NotFoundException('No sigues esta comunidad');
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.communityFollow.delete({
        where: {
          communityId_userId: { communityId: community.id, userId },
        },
      }),
      this.prisma.community.update({
        where: { id: community.id },
        data: { followersCount: { decrement: 1 } },
      }),
    ]);

    return { followersCount: updated.followersCount, isFollowing: false };
  }

  async getMyMemberships(userId: string) {
    const rows = await this.prisma.communityMember.findMany({
      where: { userId, status: CommunityMemberStatus.ACTIVE },
      orderBy: { joinedAt: 'desc' },
      include: {
        community: {
          include: {
            owner: { include: { profile: true } },
            linkedNovel: {
              select: {
                title: true,
                slug: true,
                coverUrl: true,
                author: { select: { username: true } },
              },
            },
          },
        },
      },
    });

    return rows.map((m) =>
      this.communitiesService.toResponse(m.community, {
        isMember: true,
        isFollowing: false,
        isOwner: m.community.ownerId === userId,
      }),
    );
  }

  async getMyFollowed(userId: string) {
    const rows = await this.prisma.communityFollow.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        community: {
          include: {
            owner: { include: { profile: true } },
            linkedNovel: {
              select: {
                title: true,
                slug: true,
                coverUrl: true,
                author: { select: { username: true } },
              },
            },
          },
        },
      },
    });

    return rows.map((f) =>
      this.communitiesService.toResponse(f.community, {
        isMember: false,
        isFollowing: true,
        isOwner: f.community.ownerId === userId,
      }),
    );
  }
}
