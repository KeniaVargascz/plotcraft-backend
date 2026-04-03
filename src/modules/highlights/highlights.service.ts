import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HighlightColor } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateHighlightDto } from './dto/create-highlight.dto';
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

  async listAll(userId: string, novelId?: string) {
    const rows = await this.prisma.highlight.findMany({
      where: {
        userId,
        ...(novelId ? { novelId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        chapter: true,
        novel: true,
      },
    });

    return rows.map((row) => this.toHighlightResponse(row));
  }

  async create(userId: string, dto: CreateHighlightDto) {
    if (dto.end_offset <= dto.start_offset) {
      throw new BadRequestException(
        'end_offset debe ser mayor que start_offset',
      );
    }

    const chapter = await this.prisma.chapter.findUnique({
      where: { id: dto.chapter_id },
      include: { novel: true },
    });

    if (!chapter || chapter.novelId !== dto.novel_id) {
      throw new BadRequestException(
        'El capitulo no pertenece a la novela indicada',
      );
    }

    if (!chapter.novel.isPublic && chapter.novel.authorId !== userId) {
      throw new ForbiddenException('No puedes subrayar este capitulo');
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
      throw new NotFoundException('Subrayado no encontrado');
    }

    if (highlight.userId !== userId) {
      throw new ForbiddenException('No puedes editar este subrayado');
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
      throw new NotFoundException('Subrayado no encontrado');
    }

    if (highlight.userId !== userId) {
      throw new ForbiddenException('No puedes eliminar este subrayado');
    }

    await this.prisma.highlight.delete({
      where: { id: highlightId },
    });

    return { message: 'Subrayado eliminado correctamente' };
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
      anchor_id: highlight.anchorId,
      start_offset: highlight.startOffset,
      end_offset: highlight.endOffset,
      color: highlight.color,
      note: highlight.note,
      created_at: highlight.createdAt,
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
