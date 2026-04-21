import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PollStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { VotePollDto } from '../dto/vote-poll.dto';

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

@Injectable()
export class ForumPollService {
  constructor(private readonly prisma: PrismaService) {}

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

  // ── Poll Response Helper (public so ForumService can use it for thread detail) ──

  async getPollResponse(pollId: string, viewerId?: string | null) {
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

  toPollResponse(poll: PollDetailView, viewerId?: string | null) {
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
