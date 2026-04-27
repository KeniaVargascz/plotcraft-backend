import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ForumCategory,
  ForumReactionType,
  PollStatus,
  Prisma,
  ThreadStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AUTH_SERVICE, IAuthService } from '../auth/auth.interface';
import {
  NOTIFICATIONS_SERVICE,
  INotificationsService,
} from '../notifications/notifications.interface';
import { createSlug } from '../novels/utils/slugify.util';
import { generateUniqueSlug } from '../../common/utils/unique-slug.util';
import { CreateThreadDto } from './dto/create-thread.dto';
import { ThreadQueryDto } from './dto/thread-query.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';
import { ForumPollService } from './services/forum-poll.service';
import { ForumReplyService } from './services/forum-reply.service';

type ForumAuthorView = {
  username: string;
  profile: { displayName: string | null; avatarUrl: string | null } | null;
};

type ForumReactionView = {
  userId: string;
  reactionType: ForumReactionType;
};

type ForumTagView = { tag: string };

type ThreadSummaryView = {
  id: string;
  title: string;
  slug: string;
  category: ForumCategory;
  status: ThreadStatus;
  isPinned: boolean;
  viewsCount: number;
  createdAt: Date;
  updatedAt: Date;
  author: ForumAuthorView;
  tags?: ForumTagView[];
  reactions?: ForumReactionView[];
  replies?: Array<{ id: string }>;
  poll?: { id: string } | null;
  _count?: { replies: number; reactions: number };
};

type ReplyDetailView = {
  id: string;
  content: string;
  isSolution: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: ForumAuthorView;
  reactions?: ForumReactionView[];
};

type PollOptionView = {
  id: string;
  text: string;
  order: number;
  _count?: { votes: number };
  votes?: Array<{ userId: string }>;
};

type PollDetailView = {
  id: string;
  question: string;
  status: PollStatus;
  closesAt: Date | null;
  _count?: { votes: number };
  votes?: Array<{ userId: string; optionId: string }>;
  options?: PollOptionView[];
};

type ThreadDetailView = ThreadSummaryView & {
  content: string;
  replies?: ReplyDetailView[];
  reactions?: ForumReactionView[];
  poll?: PollDetailView | null;
};

@Injectable()
export class ForumService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUTH_SERVICE)
    private readonly authService: IAuthService,
    @Inject(NOTIFICATIONS_SERVICE)
    private readonly notificationsService: INotificationsService,
    private readonly forumReplyService: ForumReplyService,
    private readonly forumPollService: ForumPollService,
  ) {}

  // ── Thread Methods ──

  async listThreads(query: ThreadQueryDto, viewerId?: string | null) {
    const limit = query.limit ?? 20;

    const statusFilter = query.status
      ? { status: query.status }
      : {
          status: {
            in: [ThreadStatus.OPEN, ThreadStatus.PINNED, ThreadStatus.CLOSED],
          },
        };

    const andConditions: Prisma.ForumThreadWhereInput[] = [
      // Soft-deleted threads excluded unless they have replies
      { OR: [{ deletedAt: null }, { replies: { some: {} } }] },
    ];

    if (query.search) {
      andConditions.push({
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { content: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    if (query.relevant && viewerId) {
      const [follows, memberships] = await Promise.all([
        this.prisma.follow.findMany({
          where: { followerId: viewerId },
          select: { followingId: true },
        }),
        this.prisma.communityMember.findMany({
          where: { userId: viewerId, status: 'ACTIVE' },
          select: { communityId: true },
        }),
      ]);
      const followedAuthorIds = follows.map((f) => f.followingId);
      const communityIds = memberships.map((m) => m.communityId);
      andConditions.push({
        OR: [
          { authorId: { in: [viewerId, ...followedAuthorIds] } },
          {
            linkedCommunities: {
              some: { communityId: { in: communityIds } },
            },
          },
        ],
      });
    }

    const where: Prisma.ForumThreadWhereInput = {
      AND: andConditions,
      ...statusFilter,
      ...(query.category ? { category: query.category } : {}),
      ...(query.tags
        ? {
            tags: {
              some: {
                tag: { in: query.tags.split(',').map((t) => t.trim()) },
              },
            },
          }
        : {}),
    };

    const orderBy = this.resolveThreadOrderBy(query.sort);

    const threads = await this.prisma.forumThread.findMany({
      where,
      take: limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy,
      include: {
        author: { include: { profile: true } },
        tags: true,
        _count: { select: { replies: true, reactions: true } },
        replies: {
          where: { isSolution: true },
          select: { id: true },
          take: 1,
        },
        poll: { select: { id: true } },
        ...(viewerId
          ? {
              reactions: {
                where: { userId: viewerId },
                select: { id: true, reactionType: true },
              },
            }
          : {}),
      },
    });

    const hasMore = threads.length > limit;
    const items = threads.slice(0, limit);

    return {
      data: items.map((thread) => this.toThreadSummary(thread, viewerId)),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  async getThread(slug: string, viewerId?: string | null) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { slug },
      include: {
        author: { include: { profile: true } },
        tags: true,
        _count: { select: { replies: true, reactions: true } },
        replies: {
          where: { deletedAt: null },
          orderBy: [{ isSolution: 'desc' }, { createdAt: 'asc' }],
          include: {
            author: { include: { profile: true } },
            reactions: true,
          },
        },
        reactions: true,
        poll: {
          include: {
            options: {
              orderBy: { order: 'asc' },
              include: {
                votes: true,
              },
            },
            votes: true,
          },
        },
      },
    });

    if (!thread || thread.deletedAt) {
      throw new NotFoundException({ statusCode: 404, message: 'Thread not found', code: 'THREAD_NOT_FOUND' });
    }

    // Increment view count if viewer is not the author
    if (viewerId !== thread.authorId) {
      await this.prisma.$executeRaw`
        UPDATE forum_threads
        SET views_count = views_count + 1
        WHERE id = ${thread.id}::uuid
      `;
    }

    let canReply = false;
    if (viewerId) {
      if (viewerId === thread.authorId) {
        canReply = true;
      } else {
        const [follow, communityMembership] = await Promise.all([
          this.prisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: viewerId,
                followingId: thread.authorId,
              },
            },
            select: { followerId: true },
          }),
          this.prisma.communityMember.findFirst({
            where: {
              userId: viewerId,
              status: 'ACTIVE',
              community: { linkedThreads: { some: { threadId: thread.id } } },
            },
            select: { id: true },
          }),
        ]);
        canReply = !!follow || !!communityMembership;
      }
    }

    return { ...this.toThreadDetail(thread, viewerId), canReply };
  }

  async getCategories() {
    const categories = Object.values(ForumCategory);

    const counts = await this.prisma.forumThread.groupBy({
      by: ['category'],
      where: { deletedAt: null },
      _count: { id: true },
    });

    const countMap = new Map(counts.map((c) => [c.category, c._count.id]));

    return categories.map((category) => ({
      category,
      threadCount: countMap.get(category) ?? 0,
    }));
  }

  async listUserThreads(username: string, query: ThreadQueryDto = {}) {
    const limit = query.limit ?? 20;

    const threads = await this.prisma.forumThread.findMany({
      where: {
        author: { username },
        deletedAt: null,
      },
      take: limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        author: { include: { profile: true } },
        tags: true,
        _count: { select: { replies: true, reactions: true } },
        replies: {
          where: { isSolution: true },
          select: { id: true },
          take: 1,
        },
        poll: { select: { id: true } },
      },
    });

    const hasMore = threads.length > limit;
    const items = threads.slice(0, limit);

    return {
      data: items.map((thread) => this.toThreadSummary(thread)),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  async listMyThreads(userId: string, query: ThreadQueryDto = {}) {
    const limit = query.limit ?? 20;

    const threads = await this.prisma.forumThread.findMany({
      where: { authorId: userId },
      take: limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        author: { include: { profile: true } },
        tags: true,
        _count: { select: { replies: true, reactions: true } },
        replies: { where: { isSolution: true }, select: { id: true }, take: 1 },
        poll: { select: { id: true } },
      },
    });

    const hasMore = threads.length > limit;
    const items = threads.slice(0, limit);

    return {
      data: items.map((thread) => this.toThreadSummary(thread)),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  async createThread(userId: string, dto: CreateThreadDto) {
    const slug = await this.generateUniqueSlug(dto.title);

    const linkedIds = Array.from(new Set(dto.linkedCommunityIds ?? []));
    if (linkedIds.length) {
      const memberships = await this.prisma.communityMember.findMany({
        where: {
          userId,
          communityId: { in: linkedIds },
          status: 'ACTIVE',
        },
        select: { communityId: true },
      });
      if (memberships.length !== linkedIds.length) {
        throw new ForbiddenException({ statusCode: 403, message: 'You can only link threads to communities you belong to', code: 'THREAD_LINK_MEMBER_REQUIRED' });
      }
    }

    const thread = await this.prisma.$transaction(async (tx) => {
      const created = await tx.forumThread.create({
        data: {
          title: dto.title.trim(),
          slug,
          content: dto.content.trim(),
          category: dto.category ?? ForumCategory.GENERAL,
          authorId: userId,
          tags: dto.tags?.length
            ? {
                create: dto.tags.map((tag) => ({
                  tag: tag.trim().toLowerCase(),
                })),
              }
            : undefined,
          linkedCommunities: linkedIds.length
            ? { create: linkedIds.map((communityId) => ({ communityId })) }
            : undefined,
        },
        include: {
          author: { include: { profile: true } },
          tags: true,
          _count: { select: { replies: true, reactions: true } },
        },
      });

      if (dto.poll) {
        await tx.forumPoll.create({
          data: {
            threadId: created.id,
            question: dto.poll.question.trim(),
            closesAt: dto.poll.closesAt ? new Date(dto.poll.closesAt) : null,
            options: {
              create: dto.poll.options.map((text, index) => ({
                text: text.trim(),
                order: index,
              })),
            },
          },
        });
      }

      return created;
    });

    return this.toThreadSummary(
      { ...thread, replies: [], poll: dto.poll ? { id: '' } : null },
      userId,
    );
  }

  async updateThread(slug: string, userId: string, dto: UpdateThreadDto) {
    const thread = await this.findOwnedThread(slug, userId);

    if (thread.status !== ThreadStatus.OPEN) {
      throw new BadRequestException({ statusCode: 400, message: 'Only open threads can be updated', code: 'THREAD_NOT_OPEN' });
    }

    const newSlug =
      dto.title && dto.title.trim() !== thread.title
        ? await this.generateUniqueSlug(dto.title, thread.id)
        : undefined;

    await this.prisma.$transaction(async (tx) => {
      if (dto.tags !== undefined) {
        await tx.forumThreadTag.deleteMany({
          where: { threadId: thread.id },
        });

        if (dto.tags.length) {
          await tx.forumThreadTag.createMany({
            data: dto.tags.map((tag) => ({
              threadId: thread.id,
              tag: tag.trim().toLowerCase(),
            })),
          });
        }
      }

      await tx.forumThread.update({
        where: { id: thread.id },
        data: {
          ...(dto.title !== undefined
            ? { title: dto.title.trim(), slug: newSlug ?? thread.slug }
            : {}),
          ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
          ...(dto.category !== undefined ? { category: dto.category } : {}),
        },
      });
    });

    return this.getThread(newSlug ?? thread.slug, userId);
  }

  async deleteThread(slug: string, userId: string) {
    const thread = await this.findOwnedThread(slug, userId);

    await this.prisma.forumThread.update({
      where: { id: thread.id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Thread deleted' };
  }

  // ── Moderation Methods ──

  async closeThread(slug: string, userId: string) {
    const thread = await this.findOwnedThread(slug, userId);

    await this.prisma.forumThread.update({
      where: { id: thread.id },
      data: { status: ThreadStatus.CLOSED },
    });

    return { message: 'Thread closed' };
  }

  async openThread(slug: string, userId: string) {
    const thread = await this.findOwnedThread(slug, userId);

    await this.prisma.forumThread.update({
      where: { id: thread.id },
      data: { status: ThreadStatus.OPEN },
    });

    return { message: 'Thread reopened' };
  }

  pinThread(slug: string) {
    void slug;
    throw new ForbiddenException({ statusCode: 403, message: 'Only admins can pin threads', code: 'PIN_ADMIN_ONLY' });
  }

  unpinThread(slug: string) {
    void slug;
    throw new ForbiddenException({ statusCode: 403, message: 'Only admins can unpin threads', code: 'UNPIN_ADMIN_ONLY' });
  }

  async archiveThread(slug: string, userId: string) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { slug },
    });
    if (!thread) throw new NotFoundException({ statusCode: 404, message: 'Thread not found', code: 'THREAD_NOT_FOUND' });
    if (thread.authorId !== userId)
      throw new ForbiddenException({ statusCode: 403, message: 'Only the author can archive this thread', code: 'THREAD_ARCHIVE_AUTHOR_ONLY' });
    await this.prisma.forumThread.update({
      where: { id: thread.id },
      data: { status: 'ARCHIVED' },
    });
    return { message: 'Thread archived' };
  }

  // ── Trending Tags ──

  async getTrendingTags(limit = 15) {
    const tags = await this.prisma.forumThreadTag.groupBy({
      by: ['tag'],
      where: { thread: { deletedAt: null } },
      _count: { tag: true },
      orderBy: { _count: { tag: 'desc' } },
      take: limit,
    });

    return tags.map((t) => ({ tag: t.tag, count: t._count.tag }));
  }

  // ── Stats ──

  async getUserStats(userId: string) {
    const [threadsCount, repliesCount, solutionsCount] = await Promise.all([
      this.prisma.forumThread.count({
        where: { authorId: userId, deletedAt: null },
      }),
      this.prisma.forumReply.count({
        where: { authorId: userId, deletedAt: null },
      }),
      this.prisma.forumReply.count({
        where: { authorId: userId, deletedAt: null, isSolution: true },
      }),
    ]);

    return { threadsCount, repliesCount, solutionsCount };
  }

  // ── Private Helpers ──

  private async findOwnedThread(slug: string, userId: string) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { slug },
    });

    if (!thread || thread.deletedAt) {
      throw new NotFoundException({ statusCode: 404, message: 'Thread not found', code: 'THREAD_NOT_FOUND' });
    }

    if (thread.authorId !== userId) {
      throw new ForbiddenException({ statusCode: 403, message: 'You are not the author of this thread', code: 'THREAD_NOT_AUTHOR' });
    }

    return thread;
  }

  private async generateUniqueSlug(title: string, ignoreId?: string) {
    return generateUniqueSlug(this.prisma, {
      title,
      model: 'forumThread',
      ignoreId,
    });
  }

  private resolveThreadOrderBy(
    sort?: ThreadQueryDto['sort'],
  ): Prisma.ForumThreadOrderByWithRelationInput[] {
    switch (sort) {
      case 'popular':
        return [
          { isPinned: 'desc' },
          { reactions: { _count: 'desc' } },
          { createdAt: 'desc' },
        ];
      case 'replies':
        return [
          { isPinned: 'desc' },
          { replies: { _count: 'desc' } },
          { createdAt: 'desc' },
        ];
      case 'unanswered':
        return [
          { isPinned: 'desc' },
          { replies: { _count: 'asc' } },
          { createdAt: 'desc' },
        ];
      case 'recent':
      default:
        return [{ isPinned: 'desc' }, { createdAt: 'desc' }];
    }
  }

  // ── Response Mappers ──

  private toThreadSummary(thread: ThreadSummaryView, viewerId?: string | null) {
    const hasSolution =
      Array.isArray(thread.replies) && thread.replies.length > 0;
    const hasPoll = !!thread.poll;
    const userReaction = Array.isArray(thread.reactions)
      ? thread.reactions.find((r) => r.userId === viewerId)
      : null;

    return {
      id: thread.id,
      title: thread.title,
      slug: thread.slug,
      category: thread.category,
      status: thread.status,
      isPinned: thread.isPinned,
      viewsCount: thread.viewsCount,
      tags: Array.isArray(thread.tags) ? thread.tags.map((t) => t.tag) : [],
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      author: {
        username: thread.author.username,
        displayName:
          thread.author.profile?.displayName ?? thread.author.username,
        avatarUrl: thread.author.profile?.avatarUrl ?? null,
      },
      stats: {
        repliesCount: thread._count?.replies ?? 0,
        reactionsCount: thread._count?.reactions ?? 0,
        hasSolution,
        hasPoll,
      },
      viewerContext: viewerId
        ? {
            hasReacted: !!userReaction,
            reactionType: userReaction?.reactionType ?? null,
          }
        : null,
    };
  }

  private toThreadDetail(thread: ThreadDetailView, viewerId?: string | null) {
    const summary = this.toThreadSummary(thread, viewerId);

    const repliesFormatted = Array.isArray(thread.replies)
      ? thread.replies
          .filter((reply): reply is ReplyDetailView => 'content' in reply)
          .map((reply) => this.forumReplyService.toReplyResponse(reply, viewerId))
      : [];

    const reactionsAll = Array.isArray(thread.reactions)
      ? thread.reactions
      : [];
    const byType = this.countReactionsByType(reactionsAll);
    const userReaction = viewerId
      ? reactionsAll.find((r) => r.userId === viewerId)
      : null;

    return {
      ...summary,
      content: thread.content,
      replies: repliesFormatted,
      reactions: {
        total: reactionsAll.length,
        byType,
        viewerContext: viewerId
          ? {
              hasReacted: !!userReaction,
              reactionType: userReaction?.reactionType ?? null,
            }
          : null,
      },
      poll: thread.poll ? this.forumPollService.toPollResponse(thread.poll, viewerId) : null,
    };
  }

  private countReactionsByType(
    reactions: { reactionType: ForumReactionType }[],
  ) {
    const byType: Record<string, number> = {};
    for (const r of reactions) {
      byType[r.reactionType] = (byType[r.reactionType] ?? 0) + 1;
    }
    return byType;
  }
}
