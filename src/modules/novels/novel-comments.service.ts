import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NovelCommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(novelSlug: string, userId: string, content: string) {
    const novel = await this.prisma.novel.findUnique({
      where: { slug: novelSlug },
      select: { id: true, authorId: true, isPublic: true },
    });

    if (!novel) throw new NotFoundException('Novela no encontrada');

    if (novel.authorId !== userId) {
      const privacy = await this.prisma.privacySettings.findUnique({
        where: { userId: novel.authorId },
      });
      if (privacy && !privacy.allowNovelComments) {
        throw new ForbiddenException(
          'El autor ha limitado los comentarios.',
        );
      }
    }

    const comment = await this.prisma.novelComment.create({
      data: {
        novelId: novel.id,
        authorId: userId,
        content: content.trim(),
      },
      include: {
        author: { include: { profile: true } },
      },
    });

    return this.toResponse(comment);
  }

  async list(novelSlug: string, cursor?: string, limit = 20) {
    const novel = await this.prisma.novel.findUnique({
      where: { slug: novelSlug },
      select: { id: true, authorId: true },
    });
    if (!novel) throw new NotFoundException('Novela no encontrada');

    const privacy = await this.prisma.privacySettings.findUnique({
      where: { userId: novel.authorId },
    });
    const commentsEnabled = privacy?.allowNovelComments ?? true;

    const where = { novelId: novel.id, deletedAt: null };

    const cursorComment = cursor
      ? await this.prisma.novelComment.findUnique({ where: { id: cursor } })
      : null;

    const comments = await this.prisma.novelComment.findMany({
      where: {
        ...where,
        ...(cursorComment
          ? { createdAt: { gt: cursorComment.createdAt } }
          : {}),
      },
      include: { author: { include: { profile: true } } },
      orderBy: { createdAt: 'asc' },
      take: limit + 1,
    });

    const hasMore = comments.length > limit;
    const items = comments.slice(0, limit);

    return {
      commentsEnabled,
      data: items.map((c) => this.toResponse(c)),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  async remove(novelSlug: string, commentId: string, userId: string) {
    const novel = await this.prisma.novel.findUnique({
      where: { slug: novelSlug },
      select: { id: true, authorId: true },
    });
    if (!novel) throw new NotFoundException('Novela no encontrada');

    const comment = await this.prisma.novelComment.findFirst({
      where: { id: commentId, novelId: novel.id, deletedAt: null },
    });
    if (!comment) throw new NotFoundException('Comentario no encontrado');

    if (novel.authorId !== userId) {
      throw new ForbiddenException('No puedes eliminar este comentario');
    }

    await this.prisma.novelComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Comentario eliminado' };
  }

  private toResponse(comment: any) {
    return {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      isDeleted: !!comment.deletedAt,
      author: {
        id: comment.author.id,
        username: comment.author.username,
        displayName: comment.author.profile?.displayName ?? null,
        avatarUrl: comment.author.profile?.avatarUrl ?? null,
      },
    };
  }
}
