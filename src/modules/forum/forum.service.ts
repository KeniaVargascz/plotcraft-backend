import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { createSlug } from '../novels/utils/slugify.util';
import { CreateReplyDto } from './dto/create-reply.dto';
import { CreateThreadDto } from './dto/create-thread.dto';
import { ForumReactionDto } from './dto/forum-reaction.dto';
import { ThreadQueryDto } from './dto/thread-query.dto';
import { UpdateReplyDto } from './dto/update-reply.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';
import { VotePollDto } from './dto/vote-poll.dto';

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
    private readonly authService: AuthService,
    private readonly notificationsService: NotificationsService,
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
      throw new NotFoundException('Thread not found');
    }

    // Increment view count if viewer is not the author
    if (viewerId !== thread.authorId) {
      await this.prisma.$executeRaw`
        UPDATE forum_threads
        SET views_count = views_count + 1
        WHERE id = ${thread.id}::uuid
      `;
    }

    return this.toThreadDetail(thread, viewerId);
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

  async listUserThreads(username: string) {
    const threads = await this.prisma.forumThread.findMany({
      where: {
        author: { username },
        deletedAt: null,
      },
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

    return threads.map((thread) => this.toThreadSummary(thread));
  }

  async listMyThreads(userId: string) {
    const threads = await this.prisma.forumThread.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { include: { profile: true } },
        tags: true,
        _count: { select: { replies: true, reactions: true } },
        replies: { where: { isSolution: true }, select: { id: true }, take: 1 },
        poll: { select: { id: true } },
      },
    });

    return threads.map((thread) => this.toThreadSummary(thread));
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
        throw new ForbiddenException(
          'Solo puedes vincular hilos a comunidades a las que perteneces.',
        );
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
      throw new BadRequestException('Only open threads can be updated');
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

  // ── Reply Methods ──

  async createReply(slug: string, userId: string, dto: CreateReplyDto) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { slug },
      include: { author: true },
    });

    if (!thread || thread.deletedAt) {
      throw new NotFoundException('Thread not found');
    }

    if (
      thread.status !== ThreadStatus.OPEN &&
      thread.status !== ThreadStatus.PINNED
    ) {
      throw new BadRequestException(
        'Cannot reply to a closed or archived thread',
      );
    }

    const reply = await this.prisma.$transaction(async (tx) => {
      const created = await tx.forumReply.create({
        data: {
          threadId: thread.id,
          authorId: userId,
          content: dto.content.trim(),
        },
        include: {
          author: { include: { profile: true } },
          reactions: true,
        },
      });
      await tx.forumThread.update({
        where: { id: thread.id },
        data: { repliesCount: { increment: 1 } },
      });
      return created;
    });

    // Send notification to thread author (if not self-reply)
    if (thread.authorId !== userId) {
      const replyAuthor = reply.author;
      this.notificationsService
        .createNotification({
          userId: thread.authorId,
          type: 'NEW_REPLY',
          title: 'New reply in your thread',
          body: `${replyAuthor.profile?.displayName ?? replyAuthor.username} replied to "${thread.title}"`,
          url: `/forum/${thread.slug}`,
          actorId: userId,
        })
        .catch(() => {
          // fire-and-forget; don't fail the reply
        });
    }

    return this.toReplyResponse(reply, userId);
  }

  async updateReply(
    slug: string,
    replyId: string,
    userId: string,
    dto: UpdateReplyDto,
  ) {
    const reply = await this.findOwnedReply(slug, replyId, userId);

    const updated = await this.prisma.forumReply.update({
      where: { id: reply.id },
      data: {
        ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
      },
      include: {
        author: { include: { profile: true } },
        reactions: true,
      },
    });

    return this.toReplyResponse(updated, userId);
  }

  async deleteReply(slug: string, replyId: string, userId: string) {
    const reply = await this.findOwnedReply(slug, replyId, userId);

    await this.prisma.$transaction(async (tx) => {
      await tx.forumReply.update({
        where: { id: reply.id },
        data: { deletedAt: new Date() },
      });
      await tx.forumThread.update({
        where: { id: reply.threadId },
        data: { repliesCount: { decrement: 1 } },
      });
    });

    return { message: 'Reply deleted' };
  }

  // ── Solution Methods ──

  async markSolution(slug: string, replyId: string, userId: string) {
    const thread = await this.findOwnedThread(slug, userId);

    const reply = await this.prisma.forumReply.findFirst({
      where: { id: replyId, threadId: thread.id, deletedAt: null },
    });

    if (!reply) {
      throw new NotFoundException('Reply not found');
    }

    // Unmark any existing solutions and mark the new one
    await this.prisma.$transaction([
      this.prisma.forumReply.updateMany({
        where: { threadId: thread.id, isSolution: true },
        data: { isSolution: false },
      }),
      this.prisma.forumReply.update({
        where: { id: replyId },
        data: { isSolution: true },
      }),
    ]);

    return { message: 'Reply marked as solution' };
  }

  async unmarkSolution(slug: string, replyId: string, userId: string) {
    const thread = await this.findOwnedThread(slug, userId);

    const reply = await this.prisma.forumReply.findFirst({
      where: { id: replyId, threadId: thread.id },
    });

    if (!reply) {
      throw new NotFoundException('Reply not found');
    }

    await this.prisma.forumReply.update({
      where: { id: replyId },
      data: { isSolution: false },
    });

    return { message: 'Solution unmarked' };
  }

  // ── Reaction Methods ──

  async toggleThreadReaction(
    slug: string,
    userId: string,
    dto: ForumReactionDto,
  ) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { slug },
    });

    if (!thread || thread.deletedAt) {
      throw new NotFoundException('Thread not found');
    }

    const reactionType = dto.reactionType ?? ForumReactionType.LIKE;

    // Find any existing reaction from this user on this thread
    const existing = await this.prisma.forumReaction.findFirst({
      where: { userId, threadId: thread.id },
    });

    if (existing) {
      if (existing.reactionType === reactionType) {
        // Same type → remove
        await this.prisma.$transaction([
          this.prisma.forumReaction.delete({ where: { id: existing.id } }),
          this.prisma.forumThread.update({
            where: { id: thread.id },
            data: { reactionsCount: { decrement: 1 } },
          }),
        ]);
      } else {
        // Different type → update
        await this.prisma.forumReaction.update({
          where: { id: existing.id },
          data: { reactionType },
        });
      }
    } else {
      // No existing → create
      await this.prisma.$transaction([
        this.prisma.forumReaction.create({
          data: {
            userId,
            threadId: thread.id,
            reactionType,
          },
        }),
        this.prisma.forumThread.update({
          where: { id: thread.id },
          data: { reactionsCount: { increment: 1 } },
        }),
      ]);
    }

    return this.getThreadReactionCounts(thread.id, userId);
  }

  async toggleReplyReaction(
    slug: string,
    replyId: string,
    userId: string,
    dto: ForumReactionDto,
  ) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { slug },
    });

    if (!thread || thread.deletedAt) {
      throw new NotFoundException('Thread not found');
    }

    const reply = await this.prisma.forumReply.findFirst({
      where: { id: replyId, threadId: thread.id, deletedAt: null },
    });

    if (!reply) {
      throw new NotFoundException('Reply not found');
    }

    const reactionType = dto.reactionType ?? ForumReactionType.LIKE;

    const existing = await this.prisma.forumReaction.findFirst({
      where: { userId, replyId: reply.id },
    });

    if (existing) {
      if (existing.reactionType === reactionType) {
        await this.prisma.forumReaction.delete({
          where: { id: existing.id },
        });
      } else {
        await this.prisma.forumReaction.update({
          where: { id: existing.id },
          data: { reactionType },
        });
      }
    } else {
      await this.prisma.forumReaction.create({
        data: {
          userId,
          replyId: reply.id,
          reactionType,
        },
      });
    }

    return this.getReplyReactionCounts(reply.id, userId);
  }

  // ── Poll Methods ──

  async votePoll(slug: string, userId: string, dto: VotePollDto) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { slug },
      include: {
        poll: {
          include: {
            options: true,
          },
        },
      },
    });

    if (!thread || thread.deletedAt) {
      throw new NotFoundException('Thread not found');
    }

    if (!thread.poll) {
      throw new NotFoundException('This thread has no poll');
    }

    if (thread.poll.status !== PollStatus.OPEN) {
      throw new BadRequestException('This poll is closed');
    }

    if (thread.poll.closesAt && new Date(thread.poll.closesAt) < new Date()) {
      throw new BadRequestException('This poll has expired');
    }

    const optionExists = thread.poll.options.some(
      (opt) => opt.id === dto.optionId,
    );

    if (!optionExists) {
      throw new BadRequestException('Invalid poll option');
    }

    try {
      await this.prisma.pollVote.create({
        data: {
          pollId: thread.poll.id,
          optionId: dto.optionId,
          userId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('You have already voted in this poll');
      }
      throw error;
    }

    return this.getPollResponse(thread.poll.id, userId);
  }

  async removeVote(slug: string, userId: string) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { slug },
      include: { poll: true },
    });

    if (!thread || thread.deletedAt) {
      throw new NotFoundException('Thread not found');
    }

    if (!thread.poll) {
      throw new NotFoundException('This thread has no poll');
    }

    const vote = await this.prisma.pollVote.findUnique({
      where: {
        pollId_userId: {
          pollId: thread.poll.id,
          userId,
        },
      },
    });

    if (!vote) {
      throw new NotFoundException('You have not voted in this poll');
    }

    await this.prisma.pollVote.delete({
      where: { id: vote.id },
    });

    return this.getPollResponse(thread.poll.id, userId);
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
    throw new ForbiddenException('Only admins can pin threads');
  }

  unpinThread(slug: string) {
    void slug;
    throw new ForbiddenException('Only admins can unpin threads');
  }

  async archiveThread(slug: string, userId: string) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { slug },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    if (thread.authorId !== userId)
      throw new ForbiddenException('Only the author can archive this thread');
    await this.prisma.forumThread.update({
      where: { id: thread.id },
      data: { status: 'ARCHIVED' },
    });
    return { message: 'Thread archived' };
  }

  // ── Private Helpers ──

  private async findOwnedThread(slug: string, userId: string) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { slug },
    });

    if (!thread || thread.deletedAt) {
      throw new NotFoundException('Thread not found');
    }

    if (thread.authorId !== userId) {
      throw new ForbiddenException('You are not the author of this thread');
    }

    return thread;
  }

  private async findOwnedReply(slug: string, replyId: string, userId: string) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { slug },
    });

    if (!thread || thread.deletedAt) {
      throw new NotFoundException('Thread not found');
    }

    const reply = await this.prisma.forumReply.findFirst({
      where: { id: replyId, threadId: thread.id, deletedAt: null },
    });

    if (!reply) {
      throw new NotFoundException('Reply not found');
    }

    if (reply.authorId !== userId) {
      throw new ForbiddenException('You are not the author of this reply');
    }

    return reply;
  }

  private async generateUniqueSlug(title: string, ignoreId?: string) {
    const baseSlug = createSlug(title);
    let candidate = baseSlug;
    let suffix = 2;

    while (true) {
      const existing = await this.prisma.forumThread.findUnique({
        where: { slug: candidate },
      });

      if (!existing || existing.id === ignoreId) {
        return candidate;
      }

      candidate = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
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

  private async getThreadReactionCounts(threadId: string, userId: string) {
    const reactions = await this.prisma.forumReaction.findMany({
      where: { threadId },
    });

    const byType = this.countReactionsByType(reactions);
    const userReaction = reactions.find((r) => r.userId === userId);

    return {
      total: reactions.length,
      byType,
      viewerContext: {
        hasReacted: !!userReaction,
        reactionType: userReaction?.reactionType ?? null,
      },
    };
  }

  private async getReplyReactionCounts(replyId: string, userId: string) {
    const reactions = await this.prisma.forumReaction.findMany({
      where: { replyId },
    });

    const byType = this.countReactionsByType(reactions);
    const userReaction = reactions.find((r) => r.userId === userId);

    return {
      total: reactions.length,
      byType,
      viewerContext: {
        hasReacted: !!userReaction,
        reactionType: userReaction?.reactionType ?? null,
      },
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

  private async getPollResponse(pollId: string, viewerId?: string | null) {
    const poll = await this.prisma.forumPoll.findUniqueOrThrow({
      where: { id: pollId },
      include: {
        options: {
          orderBy: { order: 'asc' },
          include: { _count: { select: { votes: true } } },
        },
        _count: { select: { votes: true } },
        ...(viewerId
          ? {
              votes: {
                where: { userId: viewerId },
                select: { optionId: true },
                take: 1,
              },
            }
          : {}),
      },
    });

    return this.toPollResponse(poll, viewerId);
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
          .map((reply) => this.toReplyResponse(reply, viewerId))
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
      poll: thread.poll ? this.toPollResponse(thread.poll, viewerId) : null,
    };
  }

  private toReplyResponse(reply: ReplyDetailView, viewerId?: string | null) {
    const reactions = Array.isArray(reply.reactions) ? reply.reactions : [];
    const byType = this.countReactionsByType(reactions);
    const userReaction = viewerId
      ? reactions.find((r) => r.userId === viewerId)
      : null;

    return {
      id: reply.id,
      content: reply.content,
      isSolution: reply.isSolution,
      isDeleted: !!reply.deletedAt,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
      author: {
        username: reply.author.username,
        displayName: reply.author.profile?.displayName ?? reply.author.username,
        avatarUrl: reply.author.profile?.avatarUrl ?? null,
      },
      reactions: {
        total: reactions.length,
        byType,
      },
      viewerContext: viewerId
        ? {
            hasReacted: !!userReaction,
            reactionType: userReaction?.reactionType ?? null,
          }
        : null,
    };
  }

  private toPollResponse(poll: PollDetailView, viewerId?: string | null) {
    const isExpired = poll.closesAt && new Date(poll.closesAt) < new Date();
    const effectiveStatus = isExpired ? PollStatus.CLOSED : poll.status;

    const totalVotes =
      poll._count?.votes ?? (Array.isArray(poll.votes) ? poll.votes.length : 0);

    const viewerVote =
      viewerId && Array.isArray(poll.votes)
        ? poll.votes.find((v) => v.userId === viewerId)
        : null;

    const options = Array.isArray(poll.options)
      ? poll.options.map((opt) => {
          const votesCount =
            opt._count?.votes ??
            (Array.isArray(opt.votes) ? opt.votes.length : 0);

          return {
            id: opt.id,
            text: opt.text,
            order: opt.order,
            votesCount,
            pct:
              totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0,
          };
        })
      : [];

    return {
      id: poll.id,
      question: poll.question,
      status: effectiveStatus,
      closesAt: poll.closesAt,
      totalVotes,
      options,
      viewerContext: viewerId
        ? {
            votedOptionId: viewerVote?.optionId ?? null,
          }
        : null,
    };
  }
}
