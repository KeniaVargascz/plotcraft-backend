import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NOTIFICATIONS_SERVICE,
  INotificationsService,
} from '../notifications/notifications.interface';

type FollowListOptions = {
  username: string;
  cursor?: string;
  limit?: number;
  viewerId?: string | null;
  mode: 'followers' | 'following';
};

@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATIONS_SERVICE)
    private readonly notificationsService: INotificationsService,
  ) {}

  async followUser(followerId: string, username: string) {
    const targetUser = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!targetUser) {
      throw new NotFoundException({ statusCode: 404, message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    if (targetUser.id === followerId) {
      throw new BadRequestException({ statusCode: 400, message: 'You cannot follow yourself', code: 'CANNOT_FOLLOW_SELF' });
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
      throw new ConflictException({ statusCode: 409, message: 'You are already following this user', code: 'ALREADY_FOLLOWING' });
    }

    await this.prisma.follow.create({
      data: {
        followerId,
        followingId: targetUser.id,
      },
    });

    const follower = await this.prisma.user.findUnique({
      where: { id: followerId },
      include: { profile: true },
    });

    void this.notificationsService.createNotification({
      userId: targetUser.id,
      type: 'NEW_FOLLOWER' as any,
      title: `${follower?.profile?.displayName || follower?.username} te empezo a seguir`,
      body: `Tienes un nuevo seguidor`,
      url: `/perfil/${follower?.username}`,
      actorId: followerId,
    });

    return { followed: true };
  }

  async unfollowUser(followerId: string, username: string) {
    const targetUser = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!targetUser) {
      throw new NotFoundException({ statusCode: 404, message: 'User not found', code: 'USER_NOT_FOUND' });
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
      throw new NotFoundException({ statusCode: 404, message: 'You are not following this user', code: 'NOT_FOLLOWING' });
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
      throw new NotFoundException({ statusCode: 404, message: 'User not found', code: 'USER_NOT_FOUND' });
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
