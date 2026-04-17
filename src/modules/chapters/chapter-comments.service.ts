import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChapterCommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    novelSlug: string,
    chapterSlug: string,
    userId: string,
    content: string,
    anchor?: { anchorId: string; quotedText: string; startOffset: number; endOffset: number },
  ) {
    const chapter = await this.findChapter(novelSlug, chapterSlug);

    // Reusa la preferencia de privacidad del autor de la novela
    // (allowNovelComments) tambien para los comentarios de capitulo.
    if (chapter.novel.authorId !== userId) {
      const privacy = await this.prisma.privacySettings.findUnique({
        where: { userId: chapter.novel.authorId },
      });
      if (privacy && !privacy.allowNovelComments) {
        throw new ForbiddenException('El autor ha limitado los comentarios.');
      }
    }

    const trimmed = content?.trim();
    if (!trimmed) {
      throw new ForbiddenException('El comentario no puede estar vacio.');
    }

    const comment = await this.prisma.chapterComment.create({
      data: {
        chapterId: chapter.id,
        authorId: userId,
        content: trimmed,
        ...(anchor
          ? {
              anchorId: anchor.anchorId,
              quotedText: anchor.quotedText || null,
              startOffset: anchor.startOffset ?? null,
              endOffset: anchor.endOffset ?? null,
            }
          : {}),
      },
      include: { author: { include: { profile: true } } },
    });

    return this.toResponse(comment);
  }

  async list(
    novelSlug: string,
    chapterSlug: string,
    cursor?: string,
    limit = 20,
  ) {
    const chapter = await this.findChapter(novelSlug, chapterSlug);

    const privacy = await this.prisma.privacySettings.findUnique({
      where: { userId: chapter.novel.authorId },
    });
    const commentsEnabled = privacy?.allowNovelComments ?? true;

    const cursorComment = cursor
      ? await this.prisma.chapterComment.findUnique({ where: { id: cursor } })
      : null;

    const comments = await this.prisma.chapterComment.findMany({
      where: {
        chapterId: chapter.id,
        deletedAt: null,
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

  async listByAnchor(
    novelSlug: string,
    chapterSlug: string,
    anchorId: string,
    cursor?: string,
    limit = 20,
  ) {
    const cursorDate = cursor
      ? (
          await this.prisma.chapterComment.findUnique({
            where: { id: cursor },
            select: { createdAt: true },
          })
        )?.createdAt
      : null;

    const comments = await this.prisma.chapterComment.findMany({
      where: {
        chapter: { slug: chapterSlug, novel: { slug: novelSlug } },
        anchorId,
        deletedAt: null,
        ...(cursorDate ? { createdAt: { gt: cursorDate } } : {}),
      },
      include: { author: { include: { profile: true } } },
      orderBy: { createdAt: 'asc' },
      take: limit + 1,
    });

    const hasMore = comments.length > limit;
    const items = comments.slice(0, limit);

    return {
      data: items.map((c) => this.toResponse(c)),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  async remove(
    novelSlug: string,
    chapterSlug: string,
    commentId: string,
    userId: string,
  ) {
    const chapter = await this.findChapter(novelSlug, chapterSlug);

    const comment = await this.prisma.chapterComment.findFirst({
      where: { id: commentId, chapterId: chapter.id, deletedAt: null },
    });
    if (!comment) throw new NotFoundException('Comentario no encontrado');

    if (comment.authorId !== userId && chapter.novel.authorId !== userId) {
      throw new ForbiddenException('No puedes eliminar este comentario');
    }

    await this.prisma.chapterComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Comentario eliminado' };
  }

  private async findChapter(novelSlug: string, chapterSlug: string) {
    const chapter = await this.prisma.chapter.findFirst({
      where: { slug: chapterSlug, novel: { slug: novelSlug } },
      select: {
        id: true,
        novel: { select: { id: true, authorId: true } },
      },
    });
    if (!chapter) throw new NotFoundException('Capitulo no encontrado');
    return chapter;
  }

  private toResponse(comment: {
    id: string;
    content: string;
    anchorId?: string | null;
    quotedText?: string | null;
    startOffset?: number | null;
    endOffset?: number | null;
    createdAt: Date;
    deletedAt: Date | null;
    author: {
      id: string;
      username: string;
      profile: { displayName: string | null; avatarUrl: string | null } | null;
    };
  }) {
    return {
      id: comment.id,
      content: comment.content,
      anchorId: comment.anchorId ?? null,
      quotedText: comment.quotedText ?? null,
      startOffset: comment.startOffset ?? null,
      endOffset: comment.endOffset ?? null,
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
