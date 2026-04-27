import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HighlightColor } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateHighlightDto } from './dto/create-highlight.dto';
import { HighlightQueryDto } from './dto/highlight-query.dto';
import { UpdateHighlightDto } from './dto/update-highlight.dto';

@Injectable()
export class HighlightsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByChapter(userId: string, chapterId: string) {
    const rows = await this.prisma.highlight.findMany({
      where: { userId, chapterId },
      orderBy: { createdAt: 'asc' },
      include: {
        chapter: true,
        novel: true,
      },
    });

    return rows.map((row) => this.toHighlightResponse(row));
  }

  async listAll(userId: string, query: HighlightQueryDto = {}) {
    const limit = query.limit ?? 20;

    const rows = await this.prisma.highlight.findMany({
      where: {
        userId,
        ...(query.novel_id ? { novelId: query.novel_id } : {}),
      },
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
      data: items.map((row) => this.toHighlightResponse(row)),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  async create(userId: string, dto: CreateHighlightDto) {
    if (dto.end_offset <= dto.start_offset) {
      throw new BadRequestException({ statusCode: 400, message: 'end_offset must be greater than start_offset', code: 'INVALID_HIGHLIGHT_OFFSETS' });
    }

    const chapter = await this.prisma.chapter.findUnique({
      where: { id: dto.chapter_id },
      include: { novel: true },
    });

    if (!chapter || chapter.novelId !== dto.novel_id) {
      throw new BadRequestException({ statusCode: 400, message: 'Chapter does not belong to the specified novel', code: 'CHAPTER_NOVEL_MISMATCH' });
    }

    if (!chapter.novel.isPublic && chapter.novel.authorId !== userId) {
      throw new ForbiddenException({ statusCode: 403, message: 'You cannot highlight this chapter', code: 'HIGHLIGHT_CHAPTER_FORBIDDEN' });
    }

    const highlight = await this.prisma.highlight.create({
      data: {
        userId,
        chapterId: dto.chapter_id,
        novelId: dto.novel_id,
        anchorId: dto.anchor_id,
        startOffset: dto.start_offset,
        endOffset: dto.end_offset,
        color: (dto.color ?? 'yellow') as HighlightColor,
        note: dto.note?.trim() || null,
      },
      include: {
        chapter: true,
        novel: true,
      },
    });

    return this.toHighlightResponse(highlight);
  }

  async update(userId: string, highlightId: string, dto: UpdateHighlightDto) {
    const highlight = await this.prisma.highlight.findUnique({
      where: { id: highlightId },
      include: {
        chapter: true,
        novel: true,
      },
    });

    if (!highlight) {
      throw new NotFoundException({ statusCode: 404, message: 'Highlight not found', code: 'HIGHLIGHT_NOT_FOUND' });
    }

    if (highlight.userId !== userId) {
      throw new ForbiddenException({ statusCode: 403, message: 'You cannot edit this highlight', code: 'HIGHLIGHT_EDIT_FORBIDDEN' });
    }

    const updated = await this.prisma.highlight.update({
      where: { id: highlightId },
      data: {
        ...(dto.color ? { color: dto.color as HighlightColor } : {}),
        ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
      },
      include: {
        chapter: true,
        novel: true,
      },
    });

    return this.toHighlightResponse(updated);
  }

  async remove(userId: string, highlightId: string) {
    const highlight = await this.prisma.highlight.findUnique({
      where: { id: highlightId },
    });

    if (!highlight) {
      throw new NotFoundException({ statusCode: 404, message: 'Highlight not found', code: 'HIGHLIGHT_NOT_FOUND' });
    }

    if (highlight.userId !== userId) {
      throw new ForbiddenException({ statusCode: 403, message: 'You cannot delete this highlight', code: 'HIGHLIGHT_DELETE_FORBIDDEN' });
    }

    await this.prisma.highlight.delete({
      where: { id: highlightId },
    });

    return { message: 'Highlight deleted successfully' };
  }

  private toHighlightResponse(highlight: {
    id: string;
    anchorId: string;
    startOffset: number;
    endOffset: number;
    color: HighlightColor;
    note: string | null;
    createdAt: Date;
    chapter: {
      id: string;
      slug: string;
      title: string;
    };
    novel: {
      id: string;
      slug: string;
      title: string;
    };
  }) {
    return {
      id: highlight.id,
      anchorId: highlight.anchorId,
      startOffset: highlight.startOffset,
      endOffset: highlight.endOffset,
      color: highlight.color,
      note: highlight.note,
      createdAt: highlight.createdAt,
      chapter: {
        id: highlight.chapter.id,
        slug: highlight.chapter.slug,
        title: highlight.chapter.title,
      },
      novel: {
        id: highlight.novel.id,
        slug: highlight.novel.slug,
        title: highlight.novel.title,
      },
    };
  }
}
