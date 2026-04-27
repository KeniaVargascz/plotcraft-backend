import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NOTIFICATIONS_SERVICE,
  INotificationsService,
} from '../notifications/notifications.interface';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

type CommentWithAuthor = Prisma.CommentGetPayload<{
  include: {
    author: {
      include: {
        profile: true;
      };
    };
  };
}>;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATIONS_SERVICE)
    private readonly notificationsService: INotificationsService,
  ) {}

  async createComment(postId: string, userId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException({ statusCode: 404, message: 'Post not found', code: 'POST_NOT_FOUND' });
    }

    if (post.authorId !== userId) {
      const privacy = await this.prisma.privacySettings.findUnique({
        where: { userId: post.authorId },
      });
      if (privacy && !privacy.allowPostComments) {
        throw new ForbiddenException({ statusCode: 403, message: 'The author has restricted comments', code: 'COMMENTS_RESTRICTED' });
      }
    }

    const comment = await this.prisma.comment.create({
      data: {
        postId,
        authorId: userId,
        content: dto.content.trim(),
      },
    });

    if (post.authorId !== userId) {
      void this.notificationsService.createNotification({
        userId: post.authorId,
        type: 'NEW_COMMENT' as any,
        title: `Nuevo comentario en tu publicacion`,
        body: dto.content.trim().substring(0, 100),
        url: `/feed`,
        actorId: userId,
      });
    }

    return this.getCommentById(postId, comment.id);
  }

  async listComments(postId: string, cursor?: string, limit = 20) {
    await this.ensurePost(postId);
    const cursorComment = cursor
      ? await this.prisma.comment.findFirst({ where: { id: cursor, postId } })
      : null;

    const comments = await this.prisma.comment.findMany({
      where: {
        postId,
        deletedAt: null,
        ...(cursorComment
          ? {
              createdAt: {
                gt: cursorComment.createdAt,
              },
            }
          : {}),
      },
      include: {
        author: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: limit + 1,
    });

    const trimmed = comments.slice(0, limit);

    return {
      data: trimmed.map((comment) => this.toCommentResponse(comment)),
      pagination: {
        nextCursor:
          comments.length > limit ? (trimmed.at(-1)?.id ?? null) : null,
        hasMore: comments.length > limit,
        limit,
      },
    };
  }

  async updateComment(
    postId: string,
    commentId: string,
    userId: string,
    dto: UpdateCommentDto,
  ) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, postId },
    });

    if (!comment) {
      throw new NotFoundException({ statusCode: 404, message: 'Comment not found', code: 'COMMENT_NOT_FOUND' });
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException({ statusCode: 403, message: 'You cannot edit this comment', code: 'COMMENT_EDIT_FORBIDDEN' });
    }

    await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        content: dto.content.trim(),
      },
    });

    return this.getCommentById(postId, commentId);
  }

  async deleteComment(postId: string, commentId: string, userId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, postId },
    });

    if (!comment) {
      throw new NotFoundException({ statusCode: 404, message: 'Comment not found', code: 'COMMENT_NOT_FOUND' });
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException({ statusCode: 403, message: 'You cannot delete this comment', code: 'COMMENT_DELETE_FORBIDDEN' });
    }

    await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        deletedAt: new Date(),
      },
    });

    return this.getCommentById(postId, commentId);
  }

  private async getCommentById(postId: string, commentId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, postId },
      include: {
        author: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException({ statusCode: 404, message: 'Comment not found', code: 'COMMENT_NOT_FOUND' });
    }

    return this.toCommentResponse(comment);
  }

  private toCommentResponse(comment: CommentWithAuthor) {
    return {
      id: comment.id,
      content: comment.deletedAt ? '[Comentario eliminado]' : comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      isDeleted: Boolean(comment.deletedAt),
      author: {
        id: comment.author.id,
        username: comment.author.username,
        displayName: comment.author.profile?.displayName ?? null,
        avatarUrl: comment.author.profile?.avatarUrl ?? null,
      },
    };
  }

  private async ensurePost(postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException({ statusCode: 404, message: 'Post not found', code: 'POST_NOT_FOUND' });
    }
  }
}
