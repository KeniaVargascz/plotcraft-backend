import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
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
    private readonly notificationsService: NotificationsService,
  ) {}

  async createComment(postId: string, userId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Publicacion no encontrada');
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
      ? await this.prisma.comment.findUnique({ where: { id: cursor } })
      : null;

    const comments = await this.prisma.comment.findMany({
      where: {
        postId,
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
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comentario no encontrado');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('No puedes editar este comentario');
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
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comentario no encontrado');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('No puedes eliminar este comentario');
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
      throw new NotFoundException('Comentario no encontrado');
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
      throw new NotFoundException('Publicacion no encontrada');
    }
  }
}
