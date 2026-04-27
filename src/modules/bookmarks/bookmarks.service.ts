import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BookmarkQueryDto } from './dto/bookmark-query.dto';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';

@Injectable()
export class BookmarksService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(userId: string, query: BookmarkQueryDto = {}) {
    const limit = query.limit ?? 20;

    const rows = await this.prisma.chapterBookmark.findMany({
      where: { userId },
      take: limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }],
      include: {
        chapter: true,
        novel: true,
      },
    });

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    return {
      data: items.map((row) => this.toBookmarkResponse(row)),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
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
      throw new BadRequestException({ statusCode: 400, message: 'Chapter does not belong to the specified novel', code: 'CHAPTER_NOVEL_MISMATCH' });
    }

    if (!chapter.novel.isPublic && chapter.novel.authorId !== userId) {
      throw new ForbiddenException({ statusCode: 403, message: 'You cannot bookmark this novel', code: 'BOOKMARK_NOVEL_FORBIDDEN' });
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
      throw new NotFoundException({ statusCode: 404, message: 'Bookmark not found', code: 'BOOKMARK_NOT_FOUND' });
    }

    if (bookmark.userId !== userId) {
      throw new ForbiddenException({ statusCode: 403, message: 'You cannot delete this bookmark', code: 'BOOKMARK_DELETE_FORBIDDEN' });
    }

    await this.prisma.chapterBookmark.delete({
      where: { id: bookmarkId },
    });

    return { message: 'Bookmark deleted successfully' };
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
      anchorId: bookmark.anchorId,
      label: bookmark.label,
      createdAt: bookmark.createdAt,
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
