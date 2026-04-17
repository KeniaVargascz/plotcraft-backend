import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommunityMemberStatus, Prisma, ThreadStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { createSlug } from '../novels/utils/slugify.util';
import { CommunityForumsService } from './community-forums.service';
import { CreateForumThreadDto } from './dto/create-thread.dto';

type SortBy = 'newest' | 'most_replies' | 'most_reactions';

@Injectable()
export class ForumThreadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly forums: CommunityForumsService,
  ) {}

  async listThreads(
    communitySlug: string,
    forumSlug: string,
    viewerId: string | null,
    sortBy: SortBy = 'newest',
    cursor?: string,
  ) {
    const { forum } = await this.forums.assertCanView(
      communitySlug,
      forumSlug,
      viewerId,
    );

    const limit = 20;

    const orderBy: Prisma.ForumThreadOrderByWithRelationInput[] =
      sortBy === 'most_replies'
        ? [
            { isPinned: 'desc' },
            { repliesCount: 'desc' },
            { createdAt: 'desc' },
          ]
        : sortBy === 'most_reactions'
          ? [
              { isPinned: 'desc' },
              { reactionsCount: 'desc' },
              { createdAt: 'desc' },
            ]
          : [{ isPinned: 'desc' }, { updatedAt: 'desc' }];

    const threads = await this.prisma.forumThread.findMany({
      where: { forumId: forum.id, deletedAt: null },
      orderBy,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        author: { include: { profile: true } },
        tags: true,
        _count: { select: { replies: true, reactions: true } },
      },
    });

    const hasMore = threads.length > limit;
    const items = threads.slice(0, limit);

    return {
      items: items.map((t) => ({
        id: t.id,
        title: t.title,
        slug: t.slug,
        status: t.status,
        isPinned: t.isPinned,
        viewsCount: t.viewsCount,
        repliesCount: t.repliesCount,
        reactionsCount: t.reactionsCount,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        author: {
          username: t.author.username,
          displayName: t.author.profile?.displayName ?? t.author.username,
          avatarUrl: t.author.profile?.avatarUrl ?? null,
        },
        tags: t.tags.map((tag) => tag.tag),
        stats: {
          repliesCount: t._count.replies,
          reactionsCount: t._count.reactions,
        },
      })),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  async getThread(
    communitySlug: string,
    forumSlug: string,
    threadSlug: string,
    viewerId: string | null,
  ) {
    const { forum } = await this.forums.assertCanView(
      communitySlug,
      forumSlug,
      viewerId,
    );

    const thread = await this.prisma.forumThread.findFirst({
      where: { forumId: forum.id, slug: threadSlug, deletedAt: null },
      include: {
        author: { include: { profile: true } },
        tags: true,
        poll: {
          include: {
            options: {
              orderBy: { order: 'asc' },
              include: { _count: { select: { votes: true } } },
            },
            _count: { select: { votes: true } },
          },
        },
        reactions: true,
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          take: 20,
          include: {
            author: { include: { profile: true } },
            reactions: true,
          },
        },
        _count: { select: { replies: true, reactions: true } },
      },
    });

    if (!thread) throw new NotFoundException('Hilo no encontrado.');

    if (viewerId !== thread.authorId) {
      await this.prisma.forumThread
        .update({
          where: { id: thread.id },
          data: { viewsCount: { increment: 1 } },
        })
        .catch(() => undefined);
    }

    const reactionsByType: Record<string, number> = {};
    for (const r of thread.reactions) {
      reactionsByType[r.reactionType] =
        (reactionsByType[r.reactionType] ?? 0) + 1;
    }

    return {
      id: thread.id,
      title: thread.title,
      slug: thread.slug,
      content: thread.content,
      status: thread.status,
      isPinned: thread.isPinned,
      viewsCount: thread.viewsCount + (viewerId !== thread.authorId ? 1 : 0),
      repliesCount: thread.repliesCount,
      reactionsCount: thread.reactionsCount,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      author: {
        username: thread.author.username,
        displayName:
          thread.author.profile?.displayName ?? thread.author.username,
        avatarUrl: thread.author.profile?.avatarUrl ?? null,
        bio: thread.author.profile?.bio ?? null,
      },
      tags: thread.tags.map((t) => t.tag),
      poll: thread.poll
        ? {
            id: thread.poll.id,
            question: thread.poll.question,
            status: thread.poll.status,
            closesAt: thread.poll.closesAt,
            totalVotes: thread.poll._count.votes,
            options: thread.poll.options.map((o) => ({
              id: o.id,
              text: o.text,
              order: o.order,
              votesCount: o._count.votes,
            })),
          }
        : null,
      reactions: {
        total: thread.reactions.length,
        byType: reactionsByType,
      },
      replies: thread.replies.map((reply) => ({
        id: reply.id,
        content: reply.content,
        isSolution: reply.isSolution,
        createdAt: reply.createdAt,
        author: {
          username: reply.author.username,
          displayName:
            reply.author.profile?.displayName ?? reply.author.username,
          avatarUrl: reply.author.profile?.avatarUrl ?? null,
        },
        reactions: {
          total: reply.reactions.length,
        },
      })),
    };
  }

  async createThread(
    communitySlug: string,
    forumSlug: string,
    userId: string,
    dto: CreateForumThreadDto,
  ) {
    const { forum } = await this.forums.assertCanPost(
      communitySlug,
      forumSlug,
      userId,
    );

    const slug = await this.generateUniqueSlug(dto.title);

    const linkedIds = Array.from(new Set(dto.linkedCommunityIds ?? []));
    if (linkedIds.length) {
      const memberships = await this.prisma.communityMember.findMany({
        where: {
          userId,
          communityId: { in: linkedIds },
          status: CommunityMemberStatus.ACTIVE,
        },
        select: { communityId: true },
      });
      if (memberships.length !== linkedIds.length) {
        throw new ForbiddenException(
          'Solo puedes vincular hilos a comunidades a las que perteneces.',
        );
      }
    }

    const thread = await this.prisma.$transaction(async (tx) => {
      const created = await tx.forumThread.create({
        data: {
          authorId: userId,
          forumId: forum.id,
          title: dto.title.trim(),
          slug,
          content: dto.content.trim(),
          status: ThreadStatus.OPEN,
          tags: dto.tags?.length
            ? {
                create: dto.tags.map((tag) => ({
                  tag: tag.trim().toLowerCase(),
                })),
              }
            : undefined,
          linkedCommunities: linkedIds.length
            ? {
                create: linkedIds.map((communityId) => ({ communityId })),
              }
            : undefined,
        },
        include: {
          author: { include: { profile: true } },
          tags: true,
        },
      });

      await tx.communityForum.update({
        where: { id: forum.id },
        data: { threadsCount: { increment: 1 } },
      });

      return created;
    });

    return {
      id: thread.id,
      title: thread.title,
      slug: thread.slug,
      content: thread.content,
      status: thread.status,
      createdAt: thread.createdAt,
      author: {
        username: thread.author.username,
        displayName:
          thread.author.profile?.displayName ?? thread.author.username,
        avatarUrl: thread.author.profile?.avatarUrl ?? null,
      },
      tags: thread.tags.map((t) => t.tag),
    };
  }

  async listDiscussedThreadsForCommunity(communitySlug: string, limit = 5) {
    const safeLimit = Math.max(
      1,
      Math.min(20, Number.isFinite(limit) ? limit : 5),
    );
    const community = await this.prisma.community.findUnique({
      where: { slug: communitySlug },
      select: { id: true },
    });
    if (!community) throw new NotFoundException('Comunidad no encontrada.');

    const links = await this.prisma.threadCommunityLink.findMany({
      where: {
        communityId: community.id,
        thread: {
          deletedAt: null,
          OR: [{ forumId: null }, { forum: { isPublic: true } }],
        },
      },
      include: {
        thread: {
          include: {
            author: { include: { profile: true } },
            forum: { include: { community: true } },
          },
        },
      },
    });

    const sorted = links
      .map((l) => l.thread)
      .sort(
        (a, b) =>
          b.repliesCount +
          b.reactionsCount -
          (a.repliesCount + a.reactionsCount),
      )
      .slice(0, safeLimit);

    return sorted.map((t) => ({
      id: t.id,
      title: t.title,
      slug: t.slug,
      repliesCount: t.repliesCount,
      reactionsCount: t.reactionsCount,
      createdAt: t.createdAt,
      author: {
        username: t.author.username,
        displayName: t.author.profile?.displayName ?? t.author.username,
        avatarUrl: t.author.profile?.avatarUrl ?? null,
      },
      forum: t.forum
        ? {
            name: t.forum.name,
            slug: t.forum.slug,
            communitySlug: t.forum.community.slug,
            communityName: t.forum.community.name,
          }
        : null,
      url: t.forum
        ? `/comunidades/${t.forum.community.slug}/foros/${t.forum.slug}/hilos/${t.slug}`
        : `/foro/${t.slug}`,
    }));
  }

  private async generateUniqueSlug(title: string) {
    const base = createSlug(title) || 'hilo';
    let candidate = base;
    let suffix = 2;

    while (true) {
      const existing = await this.prisma.forumThread.findUnique({
        where: { slug: candidate },
      });
      if (!existing) return candidate;
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
  }
}
