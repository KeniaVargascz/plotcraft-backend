import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type FollowListOptions = {
  username: string;
  cursor?: string;
  limit?: number;
  viewerId?: string | null;
  mode: 'followers' | 'following';
};

@Injectable()
export class FollowsService {
  constructor(private readonly prisma: PrismaService) {}

  async followUser(followerId: string, username: string) {
    const targetUser = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!targetUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (targetUser.id === followerId) {
      throw new BadRequestException('No puedes seguirte a ti mismo');
    }

    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: targetUser.id,
        },
      },
    });

    if (existingFollow) {
      throw new ConflictException('Ya sigues a este usuario');
    }

    await this.prisma.follow.create({
      data: {
        followerId,
        followingId: targetUser.id,
      },
    });

    return { followed: true };
  }

  async unfollowUser(followerId: string, username: string) {
    const targetUser = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!targetUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: targetUser.id,
        },
      },
    });

    if (!existingFollow) {
      throw new NotFoundException('No sigues a este usuario');
    }

    await this.prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId: targetUser.id,
        },
      },
    });

    return { followed: false };
  }

  async listFollowers(options: FollowListOptions) {
    return this.listRelations(options);
  }

  async listFollowing(options: FollowListOptions) {
    return this.listRelations(options);
  }

  async getSuggestions(userId: string) {
    const suggestions = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        followers: {
          none: {
            followerId: userId,
          },
        },
      },
      include: {
        profile: true,
        _count: {
          select: {
            followers: true,
          },
        },
      },
      orderBy: {
        followers: {
          _count: 'desc',
        },
      },
      take: 10,
    });

    return suggestions.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.profile?.displayName ?? null,
      avatarUrl: user.profile?.avatarUrl ?? null,
      isFollowing: false,
      followersCount: user._count.followers,
    }));
  }

  async isFollowing(followerId: string, followingId: string) {
    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    return Boolean(follow);
  }

  async getFollowingIds(userId: string) {
    const following = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    return following.map((item) => item.followingId);
  }

  private async listRelations(options: FollowListOptions) {
    const targetUser = await this.prisma.user.findUnique({
      where: { username: options.username },
    });

    if (!targetUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const limit = options.limit ?? 20;
    const cursorFollow = options.cursor
      ? await this.prisma.follow.findUnique({ where: { id: options.cursor } })
      : null;

    if (options.mode === 'followers') {
      const rows = await this.prisma.follow.findMany({
        where: {
          followingId: targetUser.id,
          ...(cursorFollow
            ? {
                createdAt: {
                  lt: cursorFollow.createdAt,
                },
              }
            : {}),
        },
        include: {
          follower: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit + 1,
      });

      const users = rows.slice(0, limit).map((item) => item.follower);
      return this.buildFollowListResponse(
        users,
        rows.length > limit,
        limit,
        rows,
        options.viewerId,
      );
    }

    const rows = await this.prisma.follow.findMany({
      where: {
        followerId: targetUser.id,
        ...(cursorFollow
          ? {
              createdAt: {
                lt: cursorFollow.createdAt,
              },
            }
          : {}),
      },
      include: {
        following: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit + 1,
    });

    const users = rows.slice(0, limit).map((item) => item.following);
    return this.buildFollowListResponse(
      users,
      rows.length > limit,
      limit,
      rows,
      options.viewerId,
    );
  }

  private async buildFollowListResponse(
    users: Array<{
      id: string;
      username: string;
      profile: {
        displayName: string | null;
        avatarUrl: string | null;
      } | null;
    }>,
    hasMore: boolean,
    limit: number,
    rows: Array<{ id: string }>,
    viewerId?: string | null,
  ) {
    let followingSet = new Set<string>();

    if (viewerId && users.length > 0) {
      const viewerRelations = await this.prisma.follow.findMany({
        where: {
          followerId: viewerId,
          followingId: { in: users.map((item) => item.id) },
        },
        select: {
          followingId: true,
        },
      });
      followingSet = new Set(viewerRelations.map((item) => item.followingId));
    }

    return {
      data: users.map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.profile?.displayName ?? null,
        avatarUrl: user.profile?.avatarUrl ?? null,
        isFollowing: viewerId ? followingSet.has(user.id) : false,
      })),
      pagination: {
        nextCursor: hasMore ? (rows.slice(0, limit).at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }
}
