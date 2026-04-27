import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Community,
  CommunityMemberRole,
  CommunityMemberStatus,
  CommunityStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { createSlug } from '../novels/utils/slugify.util';
import { generateUniqueSlug } from '../../common/utils/unique-slug.util';
import { CreateForumDto } from './dto/create-forum.dto';
import { UpdateForumDto } from './dto/update-forum.dto';

@Injectable()
export class CommunityForumsService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCommunityOwnerOrMod(
    communitySlug: string,
    userId: string,
  ): Promise<Community> {
    const community = await this.prisma.community.findUnique({
      where: { slug: communitySlug },
    });
    if (!community) {
      throw new NotFoundException({ statusCode: 404, message: 'Community not found', code: 'COMMUNITY_NOT_FOUND' });
    }
    const member = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: community.id,
          userId,
        },
      },
    });
    const isOwner = community.ownerId === userId;
    if (
      !isOwner &&
      (!member ||
        (member.role !== CommunityMemberRole.ADMIN &&
          member.role !== CommunityMemberRole.MODERATOR))
    ) {
      throw new ForbiddenException({ statusCode: 403, message: 'Only the creator or moderators can perform this action', code: 'OWNER_OR_MOD_REQUIRED' });
    }
    return community;
  }

  private async getActiveCommunity(slug: string) {
    const community = await this.prisma.community.findUnique({
      where: { slug },
    });
    if (!community || community.status !== CommunityStatus.ACTIVE) {
      throw new NotFoundException({ statusCode: 404, message: 'Community not found', code: 'COMMUNITY_NOT_FOUND' });
    }
    return community;
  }

  async listForums(communitySlug: string, viewerId: string | null) {
    const community = await this.getActiveCommunity(communitySlug);

    const forums = await this.prisma.communityForum.findMany({
      where: { communityId: community.id },
      orderBy: { createdAt: 'asc' },
    });

    const forumIds = forums.map((f) => f.id);

    const lastThreads = forumIds.length
      ? await this.prisma.forumThread.findMany({
          where: {
            forumId: { in: forumIds },
            deletedAt: null,
            status: { not: 'ARCHIVED' },
          },
          orderBy: { createdAt: 'desc' },
          include: { author: { include: { profile: true } } },
        })
      : [];

    const lastByForum = new Map<string, (typeof lastThreads)[number]>();
    for (const t of lastThreads) {
      if (t.forumId && !lastByForum.has(t.forumId)) {
        lastByForum.set(t.forumId, t);
      }
    }

    const memberships =
      viewerId && forumIds.length
        ? await this.prisma.forumMember.findMany({
            where: { userId: viewerId, forumId: { in: forumIds } },
            select: { forumId: true },
          })
        : [];
    const memberSet = new Set(memberships.map((m) => m.forumId));

    return forums.map((f) => {
      const last = lastByForum.get(f.id) ?? null;
      return {
        id: f.id,
        name: f.name,
        slug: f.slug,
        description: f.description,
        rules: f.rules,
        isPublic: f.isPublic,
        membersCount: f.membersCount,
        threadsCount: f.threadsCount,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        lastThread: last
          ? {
              title: last.title,
              slug: last.slug,
              createdAt: last.createdAt,
              author: {
                username: last.author.username,
                avatarUrl: last.author.profile?.avatarUrl ?? null,
              },
            }
          : null,
        isMember: viewerId ? memberSet.has(f.id) : false,
      };
    });
  }

  async getForumOrThrow(communitySlug: string, forumSlug: string) {
    const community = await this.getActiveCommunity(communitySlug);
    const forum = await this.prisma.communityForum.findUnique({
      where: {
        communityId_slug: {
          communityId: community.id,
          slug: forumSlug,
        },
      },
    });
    if (!forum) {
      throw new NotFoundException({ statusCode: 404, message: 'Forum not found', code: 'FORUM_NOT_FOUND' });
    }
    return { community, forum };
  }

  async createForum(
    communitySlug: string,
    userId: string,
    dto: CreateForumDto,
  ) {
    const community = await this.assertCommunityOwnerOrMod(
      communitySlug,
      userId,
    );

    const slug = await this.generateUniqueSlug(community.id, dto.name);

    const forum = await this.prisma.communityForum.create({
      data: {
        communityId: community.id,
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim() ?? null,
        rules: dto.rules?.trim() ?? null,
        isPublic: dto.isPublic ?? true,
      },
    });

    return forum;
  }

  async updateForum(
    communitySlug: string,
    forumSlug: string,
    userId: string,
    dto: UpdateForumDto,
  ) {
    const community = await this.assertCommunityOwnerOrMod(
      communitySlug,
      userId,
    );
    const forum = await this.prisma.communityForum.findUnique({
      where: {
        communityId_slug: { communityId: community.id, slug: forumSlug },
      },
    });
    if (!forum) throw new NotFoundException({ statusCode: 404, message: 'Forum not found', code: 'FORUM_NOT_FOUND' });

    const updated = await this.prisma.communityForum.update({
      where: { id: forum.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() ?? null }
          : {}),
        ...(dto.rules !== undefined
          ? { rules: dto.rules?.trim() ?? null }
          : {}),
        ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
      },
    });

    return updated;
  }

  async deleteForum(communitySlug: string, forumSlug: string, userId: string) {
    const community = await this.prisma.community.findUnique({
      where: { slug: communitySlug },
    });
    if (!community) throw new NotFoundException({ statusCode: 404, message: 'Community not found', code: 'COMMUNITY_NOT_FOUND' });
    if (community.ownerId !== userId) {
      throw new ForbiddenException({ statusCode: 403, message: 'Only the community creator can delete forums', code: 'FORUM_DELETE_OWNER_ONLY' });
    }
    const forum = await this.prisma.communityForum.findUnique({
      where: {
        communityId_slug: { communityId: community.id, slug: forumSlug },
      },
    });
    if (!forum) throw new NotFoundException({ statusCode: 404, message: 'Forum not found', code: 'FORUM_NOT_FOUND' });

    await this.prisma.communityForum.delete({ where: { id: forum.id } });
    return null;
  }

  async joinForum(communitySlug: string, forumSlug: string, userId: string) {
    const { community, forum } = await this.getForumOrThrow(
      communitySlug,
      forumSlug,
    );

    if (!forum.isPublic) {
      const member = await this.prisma.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: community.id,
            userId,
          },
        },
      });
      if (!member || member.status !== CommunityMemberStatus.ACTIVE) {
        throw new ForbiddenException({ statusCode: 403, message: 'This forum is private. Join the community first.', code: 'FORUM_PRIVATE_JOIN_COMMUNITY' });
      }
    }

    const existing = await this.prisma.forumMember.findUnique({
      where: { forumId_userId: { forumId: forum.id, userId } },
    });
    if (existing) {
      throw new ConflictException({ statusCode: 409, message: 'You are already a member of this forum', code: 'ALREADY_FORUM_MEMBER' });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.forumMember.create({
        data: { forumId: forum.id, userId },
      });
      return tx.communityForum.update({
        where: { id: forum.id },
        data: { membersCount: { increment: 1 } },
      });
    });

    return { membersCount: updated.membersCount, isMember: true };
  }

  async leaveForum(communitySlug: string, forumSlug: string, userId: string) {
    const { forum } = await this.getForumOrThrow(communitySlug, forumSlug);

    const existing = await this.prisma.forumMember.findUnique({
      where: { forumId_userId: { forumId: forum.id, userId } },
    });
    if (!existing) {
      throw new NotFoundException({ statusCode: 404, message: 'You are not a member of this forum', code: 'NOT_FORUM_MEMBER' });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.forumMember.delete({ where: { id: existing.id } });
      const current = await tx.communityForum.findUniqueOrThrow({
        where: { id: forum.id },
      });
      const next = Math.max(0, current.membersCount - 1);
      return tx.communityForum.update({
        where: { id: forum.id },
        data: { membersCount: next },
      });
    });

    return { membersCount: updated.membersCount, isMember: false };
  }

  private async generateUniqueSlug(communityId: string, name: string) {
    return generateUniqueSlug(this.prisma, {
      title: name || 'foro',
      model: 'communityForum',
      scope: { communityId },
    });
  }

  /**
   * Asserts that the viewer can see the forum (used for thread reads).
   */
  async assertCanView(
    communitySlug: string,
    forumSlug: string,
    viewerId: string | null,
  ) {
    const { community, forum } = await this.getForumOrThrow(
      communitySlug,
      forumSlug,
    );

    if (forum.isPublic) {
      return { community, forum };
    }

    if (!viewerId) {
      throw new ForbiddenException({ statusCode: 403, message: 'This forum is private', code: 'FORUM_PRIVATE' });
    }

    const [member, communityMember] = await Promise.all([
      this.prisma.forumMember.findUnique({
        where: { forumId_userId: { forumId: forum.id, userId: viewerId } },
      }),
      this.prisma.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: community.id,
            userId: viewerId,
          },
        },
      }),
    ]);

    if (
      !member &&
      (!communityMember ||
        communityMember.status !== CommunityMemberStatus.ACTIVE)
    ) {
      throw new ForbiddenException({ statusCode: 403, message: 'You do not have access to this forum', code: 'FORUM_ACCESS_DENIED' });
    }

    return { community, forum };
  }

  /**
   * Asserts the viewer can publish in the forum.
   */
  async assertCanPost(
    communitySlug: string,
    forumSlug: string,
    userId: string,
  ) {
    const { community, forum } = await this.getForumOrThrow(
      communitySlug,
      forumSlug,
    );

    const [forumMember, communityMember] = await Promise.all([
      this.prisma.forumMember.findUnique({
        where: { forumId_userId: { forumId: forum.id, userId } },
      }),
      this.prisma.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: community.id,
            userId,
          },
        },
      }),
    ]);

    const isCommunityActive =
      !!communityMember &&
      communityMember.status === CommunityMemberStatus.ACTIVE;

    if (forum.isPublic) {
      if (!forumMember && !isCommunityActive) {
        throw new ForbiddenException({ statusCode: 403, message: 'Join the forum to post', code: 'FORUM_JOIN_TO_POST' });
      }
    } else {
      if (!forumMember) {
        throw new ForbiddenException({ statusCode: 403, message: 'You must be a member of this forum to post', code: 'FORUM_MEMBER_REQUIRED' });
      }
    }

    return { community, forum };
  }
}

export type Unused = Prisma.CommunityForumWhereInput;
