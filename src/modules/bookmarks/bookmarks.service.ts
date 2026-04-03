import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';

@Injectable()
export class BookmarksService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(userId: string) {
    const rows = await this.prisma.chapterBookmark.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        chapter: true,
        novel: true,
      },
    });

    const grouped = new Map<
      string,
      {
        novel: { id: string; slug: string; title: string };
        bookmarks: ReturnType<BookmarksService['toBookmarkResponse']>[];
      }
    >();

    for (const row of rows) {
      if (!grouped.has(row.novelId)) {
        grouped.set(row.novelId, {
          novel: {
            id: row.novel.id,
            slug: row.novel.slug,
            title: row.novel.title,
          },
          bookmarks: [],
        });
      }

      grouped.get(row.novelId)?.bookmarks.push(this.toBookmarkResponse(row));
    }

    return [...grouped.values()];
  }

  async listByChapter(userId: string, chapterId: string) {
    const rows = await this.prisma.chapterBookmark.findMany({
      where: {
        userId,
        chapterId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        chapter: true,
        novel: true,
      },
    });

    return rows.map((row) => this.toBookmarkResponse(row));
  }

  async create(userId: string, dto: CreateBookmarkDto) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: dto.chapter_id },
      include: {
        novel: true,
      },
    });

    if (!chapter || chapter.novelId !== dto.novel_id) {
      throw new BadRequestException(
        'El capitulo no pertenece a la novela indicada',
      );
    }

    if (!chapter.novel.isPublic && chapter.novel.authorId !== userId) {
      throw new ForbiddenException('No puedes marcar esta novela');
    }

    const bookmark = await this.prisma.chapterBookmark.create({
      data: {
        userId,
        chapterId: dto.chapter_id,
        novelId: dto.novel_id,
        anchorId: dto.anchor_id?.trim() || null,
        label: dto.label?.trim() || null,
      },
      include: {
        chapter: true,
        novel: true,
      },
    });

    return this.toBookmarkResponse(bookmark);
  }

  async remove(userId: string, bookmarkId: string) {
    const bookmark = await this.prisma.chapterBookmark.findUnique({
      where: { id: bookmarkId },
    });

    if (!bookmark) {
      throw new NotFoundException('Marcador no encontrado');
    }

    if (bookmark.userId !== userId) {
      throw new ForbiddenException('No puedes eliminar este marcador');
    }

    await this.prisma.chapterBookmark.delete({
      where: { id: bookmarkId },
    });

    return { message: 'Marcador eliminado correctamente' };
  }

  private toBookmarkResponse(bookmark: {
    id: string;
    anchorId: string | null;
    label: string | null;
    createdAt: Date;
    chapter: {
      id: string;
      slug: string;
      title: string;
      order: number;
    };
    novel: {
      id: string;
      slug: string;
      title: string;
    };
  }) {
    return {
      id: bookmark.id,
      anchor_id: bookmark.anchorId,
      label: bookmark.label,
      created_at: bookmark.createdAt,
      chapter: {
        id: bookmark.chapter.id,
        slug: bookmark.chapter.slug,
        title: bookmark.chapter.title,
        order: bookmark.chapter.order,
      },
      novel: {
        id: bookmark.novel.id,
        slug: bookmark.novel.slug,
        title: bookmark.novel.title,
      },
    };
  }
}
