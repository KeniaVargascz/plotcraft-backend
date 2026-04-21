import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ForumReactionType, ThreadStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  NOTIFICATIONS_SERVICE,
  INotificationsService,
} from '../../notifications/notifications.interface';
import { CreateReplyDto } from '../dto/create-reply.dto';
import { UpdateReplyDto } from '../dto/update-reply.dto';

type ForumAuthorView = {
  username: string;
  profile: { displayName: string | null; avatarUrl: string | null } | null;
};

type ForumReactionView = {
  userId: string;
  reactionType: ForumReactionType;
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

@Injectable()
export class ForumReplyService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATIONS_SERVICE)
    private readonly notificationsService: INotificationsService,
  ) {}

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

    if (thread.authorId !== userId) {
      const [follow, communityMembership] = await Promise.all([
        this.prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: userId,
              followingId: thread.authorId,
            },
          },
          select: { followerId: true },
        }),
        this.prisma.communityMember.findFirst({
          where: {
            userId,
            status: 'ACTIVE',
            community: {
              linkedThreads: { some: { threadId: thread.id } },
            },
          },
          select: { id: true },
        }),
      ]);
      if (!follow && !communityMembership) {
        throw new ForbiddenException(
          'Solo puedes comentar en hilos de autores que sigues o de comunidades a las que perteneces.',
        );
      }
    }

    if (dto.parentReplyId) {
      const parent = await this.prisma.forumReply.findUnique({
        where: { id: dto.parentReplyId },
        select: { id: true, threadId: true, deletedAt: true },
      });
      if (!parent || parent.deletedAt || parent.threadId !== thread.id) {
        throw new NotFoundException('Parent reply not found in this thread');
      }
    }

    const reply = await this.prisma.$transaction(async (tx) => {
      const created = await tx.forumReply.create({
        data: {
          threadId: thread.id,
          authorId: userId,
          content: dto.content.trim(),
          parentReplyId: dto.parentReplyId ?? null,
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

  // ── Response Mapper ──

  toReplyResponse(reply: ReplyDetailView, viewerId?: string | null) {
    const reactions = Array.isArray(reply.reactions) ? reply.reactions : [];
    const byType = this.countReactionsByType(reactions);
    const userReaction = viewerId
      ? reactions.find((r) => r.userId === viewerId)
      : null;

    return {
      id: reply.id,
      content: reply.content,
      parentReplyId:
        (reply as { parentReplyId?: string | null }).parentReplyId ?? null,
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
