import { Injectable, NotFoundException } from '@nestjs/common';
import { ForumReactionType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ForumReactionDto } from '../dto/forum-reaction.dto';

@Injectable()
export class ForumReactionService {
  constructor(private readonly prisma: PrismaService) {}

  async toggleThreadReaction(
    slug: string,
    userId: string,
    dto: ForumReactionDto,
  ) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { slug },
    });

    if (!thread || thread.deletedAt) {
      throw new NotFoundException({ statusCode: 404, message: 'Thread not found', code: 'THREAD_NOT_FOUND' });
    }

    const reactionType = dto.reactionType ?? ForumReactionType.LIKE;

    // Find any existing reaction from this user on this thread
    const existing = await this.prisma.forumReaction.findFirst({
      where: { userId, threadId: thread.id },
    });

    if (existing) {
      if (existing.reactionType === reactionType) {
        // Same type -> remove
        await this.prisma.$transaction([
          this.prisma.forumReaction.delete({ where: { id: existing.id } }),
          this.prisma.forumThread.update({
            where: { id: thread.id },
            data: { reactionsCount: { decrement: 1 } },
          }),
        ]);
      } else {
        // Different type -> update
        await this.prisma.forumReaction.update({
          where: { id: existing.id },
          data: { reactionType },
        });
      }
    } else {
      // No existing -> create
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
      throw new NotFoundException({ statusCode: 404, message: 'Thread not found', code: 'THREAD_NOT_FOUND' });
    }

    const reply = await this.prisma.forumReply.findFirst({
      where: { id: replyId, threadId: thread.id, deletedAt: null },
    });

    if (!reply) {
      throw new NotFoundException({ statusCode: 404, message: 'Reply not found', code: 'REPLY_NOT_FOUND' });
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

  // ── Private Helpers ──

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
}
