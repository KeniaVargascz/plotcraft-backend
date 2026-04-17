import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, VisualBoard } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AddItemDto } from './dto/add-item.dto';
import { CreateBoardDto } from './dto/create-board.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';
import { ReorderSectionsDto } from './dto/reorder-sections.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { VisualBoardQueryDto } from './dto/visual-board-query.dto';

type Tx = Prisma.TransactionClient;
type LinkedType = 'novel' | 'world' | 'character' | 'series';

@Injectable()
export class VisualBoardsService {
  constructor(private readonly prisma: PrismaService) {}

  async assertBoardOwner(
    boardId: string,
    userId: string,
  ): Promise<VisualBoard> {
    const board = await this.prisma.visualBoard.findUnique({
      where: { id: boardId },
    });
    if (!board) throw new NotFoundException('Tablero no encontrado');
    if (board.authorId !== userId) {
      throw new ForbiddenException('No puedes gestionar este tablero');
    }
    return board;
  }

  async listMine(userId: string, query: VisualBoardQueryDto) {
    const boards = await this.prisma.visualBoard.findMany({
      where: {
        authorId: userId,
        ...this.buildBoardWhere(query),
      },
      orderBy: { updatedAt: 'desc' },
      include: this.boardListInclude(),
    });

    return boards.map((board) => this.toBoardListItem(board));
  }

  async listPublicByUsername(username: string, query: VisualBoardQueryDto) {
    const limit = 12;
    const rows = await this.prisma.visualBoard.findMany({
      where: {
        isPublic: true,
        author: { username },
        ...this.buildBoardWhere(query),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: this.boardListInclude(),
    });

    const hasMore = rows.length > limit;
    const items = rows
      .slice(0, limit)
      .map((board) => this.toBoardListItem(board));

    return {
      data: items,
      pagination: {
        nextCursor: hasMore ? (rows[limit - 1]?.id ?? null) : null,
        hasMore,
      },
    };
  }

  async getById(id: string, viewerId: string | null) {
    const board = await this.prisma.visualBoard.findUnique({
      where: { id },
      include: {
        author: {
          include: {
            profile: true,
          },
        },
        sections: {
          orderBy: { orderIndex: 'asc' },
          include: {
            items: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    });
    if (!board || (!board.isPublic && board.authorId !== viewerId)) {
      throw new NotFoundException('Tablero no encontrado');
    }

    const linked = await this.resolveLinkedEntity(
      board.linkedType,
      board.linkedId,
    );

    return {
      id: board.id,
      title: board.title,
      description: board.description,
      coverUrl: board.coverUrl,
      isPublic: board.isPublic,
      linkedType: board.linkedType,
      linkedId: board.linkedId,
      linkedTitle: linked?.title ?? null,
      linkedSlug: linked?.slug ?? null,
      author: {
        username: board.author.username,
        displayName: board.author.profile?.displayName ?? board.author.username,
        avatarUrl: board.author.profile?.avatarUrl ?? null,
      },
      sectionsCount: board.sections.length,
      totalImagesCount: board.sections.reduce(
        (sum, section) => sum + section.items.length,
        0,
      ),
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
      sections: board.sections.map((section) => ({
        id: section.id,
        title: section.title,
        orderIndex: section.orderIndex,
        items: section.items.map((item) => ({
          id: item.id,
          imageUrl: item.imageUrl,
          caption: item.caption,
          orderIndex: item.orderIndex,
          createdAt: item.createdAt,
        })),
      })),
    };
  }

  async create(userId: string, dto: CreateBoardDto) {
    await this.validateLinkedTarget(userId, dto.linkedType, dto.linkedId);

    const board = await this.prisma.visualBoard.create({
      data: {
        authorId: userId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        coverUrl: dto.coverUrl?.trim() || null,
        isPublic: dto.isPublic ?? false,
        linkedType: dto.linkedType ?? null,
        linkedId: dto.linkedId ?? null,
      },
      include: this.boardListInclude(),
    });

    return this.toBoardListItem(board);
  }

  async update(id: string, userId: string, dto: UpdateBoardDto) {
    const board = await this.assertBoardOwner(id, userId);
    await this.validateLinkedTarget(
      userId,
      dto.linkedType ?? board.linkedType ?? undefined,
      dto.linkedId ?? board.linkedId ?? undefined,
    );

    const updated = await this.prisma.visualBoard.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.coverUrl !== undefined
          ? { coverUrl: dto.coverUrl?.trim() || null }
          : {}),
        ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
        ...(dto.linkedType !== undefined
          ? { linkedType: dto.linkedType || null }
          : {}),
        ...(dto.linkedId !== undefined
          ? { linkedId: dto.linkedId || null }
          : {}),
      },
      include: this.boardListInclude(),
    });

    return this.toBoardListItem(updated);
  }

  async remove(id: string, userId: string) {
    await this.assertBoardOwner(id, userId);
    await this.prisma.visualBoard.delete({ where: { id } });
  }

  async createSection(boardId: string, userId: string, dto: CreateSectionDto) {
    await this.assertBoardOwner(boardId, userId);
    const section = await this.prisma.$transaction(async (tx) => {
      const max = await tx.visualBoardSection.aggregate({
        where: { boardId },
        _max: { orderIndex: true },
      });
      const created = await tx.visualBoardSection.create({
        data: {
          boardId,
          title: dto.title.trim(),
          orderIndex: (max._max.orderIndex ?? 0) + 1,
        },
      });
      await this.touchBoard(tx, boardId);
      return created;
    });

    return section;
  }

  async updateSection(
    boardId: string,
    sectionId: string,
    userId: string,
    dto: UpdateSectionDto,
  ) {
    await this.assertBoardOwner(boardId, userId);
    await this.findSectionOrThrow(boardId, sectionId);
    const section = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.visualBoardSection.update({
        where: { id: sectionId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        },
      });
      await this.touchBoard(tx, boardId);
      return updated;
    });

    return section;
  }

  async removeSection(boardId: string, sectionId: string, userId: string) {
    await this.assertBoardOwner(boardId, userId);
    await this.findSectionOrThrow(boardId, sectionId);
    await this.prisma.$transaction(async (tx) => {
      await tx.visualBoardSection.delete({ where: { id: sectionId } });
      await this.reindexSections(tx, boardId);
      await this.touchBoard(tx, boardId);
    });
  }

  async reorderSections(
    boardId: string,
    userId: string,
    dto: ReorderSectionsDto,
  ) {
    await this.assertBoardOwner(boardId, userId);
    const sections = await this.prisma.visualBoardSection.findMany({
      where: { boardId },
    });
    this.validateReorderSet(
      sections.map((section) => section.id),
      dto.sections.map((section) => section.sectionId),
      'secciones',
    );

    await this.prisma.$transaction(async (tx) => {
      for (const [index, section] of dto.sections.entries()) {
        await tx.visualBoardSection.update({
          where: { id: section.sectionId },
          data: { orderIndex: -(index + 1) },
        });
      }
      for (const section of dto.sections) {
        await tx.visualBoardSection.update({
          where: { id: section.sectionId },
          data: { orderIndex: section.orderIndex },
        });
      }
      await this.touchBoard(tx, boardId);
    });

    return this.getById(boardId, userId);
  }

  async addItem(
    boardId: string,
    sectionId: string,
    userId: string,
    dto: AddItemDto,
  ) {
    await this.assertBoardOwner(boardId, userId);
    await this.findSectionOrThrow(boardId, sectionId);
    const item = await this.prisma.$transaction(async (tx) => {
      const max = await tx.visualBoardItem.aggregate({
        where: { sectionId },
        _max: { orderIndex: true },
      });
      const created = await tx.visualBoardItem.create({
        data: {
          sectionId,
          imageUrl: dto.imageUrl.trim(),
          caption: dto.caption?.trim() || null,
          orderIndex: (max._max.orderIndex ?? 0) + 1,
        },
      });
      await this.touchBoard(tx, boardId);
      return created;
    });

    return item;
  }

  async updateItem(
    boardId: string,
    sectionId: string,
    itemId: string,
    userId: string,
    dto: UpdateItemDto,
  ) {
    await this.assertBoardOwner(boardId, userId);
    await this.findItemOrThrow(sectionId, itemId);
    const item = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.visualBoardItem.update({
        where: { id: itemId },
        data: {
          ...(dto.caption !== undefined
            ? { caption: dto.caption?.trim() || null }
            : {}),
        },
      });
      await this.touchBoard(tx, boardId);
      return updated;
    });

    return item;
  }

  async removeItem(
    boardId: string,
    sectionId: string,
    itemId: string,
    userId: string,
  ) {
    await this.assertBoardOwner(boardId, userId);
    await this.findItemOrThrow(sectionId, itemId);
    await this.prisma.$transaction(async (tx) => {
      await tx.visualBoardItem.delete({ where: { id: itemId } });
      await this.reindexItems(tx, sectionId);
      await this.touchBoard(tx, boardId);
    });
  }

  async reorderItems(
    boardId: string,
    sectionId: string,
    userId: string,
    dto: ReorderItemsDto,
  ) {
    await this.assertBoardOwner(boardId, userId);
    await this.findSectionOrThrow(boardId, sectionId);
    const items = await this.prisma.visualBoardItem.findMany({
      where: { sectionId },
    });
    this.validateReorderSet(
      items.map((item) => item.id),
      dto.items.map((item) => item.itemId),
      'imagenes',
    );

    await this.prisma.$transaction(async (tx) => {
      for (const [index, item] of dto.items.entries()) {
        await tx.visualBoardItem.update({
          where: { id: item.itemId },
          data: { orderIndex: -(index + 1) },
        });
      }
      for (const item of dto.items) {
        await tx.visualBoardItem.update({
          where: { id: item.itemId },
          data: { orderIndex: item.orderIndex },
        });
      }
      await this.touchBoard(tx, boardId);
    });

    return this.getById(boardId, userId);
  }

  private buildBoardWhere(
    query: VisualBoardQueryDto,
  ): Prisma.VisualBoardWhereInput {
    const where: Prisma.VisualBoardWhereInput = {};

    if (query.linkedType === 'free') {
      where.linkedType = null;
      where.linkedId = null;
    } else if (query.linkedType) {
      where.linkedType = query.linkedType;
    }

    if (query.linkedId) {
      where.linkedId = query.linkedId;
    }

    if (query.isPublic !== undefined) {
      where.isPublic = query.isPublic;
    }

    return where;
  }

  private boardListInclude() {
    return {
      author: {
        include: {
          profile: true,
        },
      },
      sections: {
        orderBy: { orderIndex: 'asc' as const },
        include: {
          items: {
            orderBy: { orderIndex: 'asc' as const },
            select: {
              imageUrl: true,
            },
          },
        },
      },
    } satisfies Prisma.VisualBoardInclude;
  }

  private toBoardListItem(
    board: Prisma.VisualBoardGetPayload<{
      include: ReturnType<VisualBoardsService['boardListInclude']>;
    }>,
  ) {
    const previewImages = board.sections
      .flatMap((section) => section.items.map((item) => item.imageUrl))
      .slice(0, 4);

    return {
      id: board.id,
      title: board.title,
      description: board.description,
      coverUrl: board.coverUrl,
      isPublic: board.isPublic,
      linkedType: board.linkedType,
      linkedId: board.linkedId,
      sectionsCount: board.sections.length,
      totalImagesCount: board.sections.reduce(
        (sum, section) => sum + section.items.length,
        0,
      ),
      previewImages,
      author: {
        username: board.author.username,
        displayName: board.author.profile?.displayName ?? board.author.username,
        avatarUrl: board.author.profile?.avatarUrl ?? null,
      },
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
    };
  }

  private async validateLinkedTarget(
    userId: string,
    linkedType?: string | null,
    linkedId?: string | null,
  ) {
    if ((linkedType && !linkedId) || (!linkedType && linkedId)) {
      throw new UnprocessableEntityException(
        'linkedType y linkedId deben enviarse juntos.',
      );
    }
    if (!linkedType || !linkedId) {
      return;
    }

    const target = await this.resolveOwnedLinkedEntity(
      userId,
      linkedType as LinkedType,
      linkedId,
    );
    if (!target) {
      throw new UnprocessableEntityException(
        'El elemento vinculado no existe o no pertenece al autor.',
      );
    }
  }

  private async resolveOwnedLinkedEntity(
    userId: string,
    linkedType: LinkedType,
    linkedId: string,
  ) {
    switch (linkedType) {
      case 'novel':
        return this.prisma.novel.findFirst({
          where: { id: linkedId, authorId: userId },
          select: { id: true },
        });
      case 'world':
        return this.prisma.world.findFirst({
          where: { id: linkedId, authorId: userId },
          select: { id: true },
        });
      case 'character':
        return this.prisma.character.findFirst({
          where: { id: linkedId, authorId: userId },
          select: { id: true },
        });
      case 'series':
        return this.prisma.series.findFirst({
          where: { id: linkedId, authorId: userId },
          select: { id: true },
        });
      default:
        return null;
    }
  }

  private async resolveLinkedEntity(
    linkedType?: string | null,
    linkedId?: string | null,
  ) {
    if (!linkedType || !linkedId) return null;

    switch (linkedType as LinkedType) {
      case 'novel':
        return this.prisma.novel.findUnique({
          where: { id: linkedId },
          select: { title: true, slug: true },
        });
      case 'world':
        return this.prisma.world
          .findUnique({
            where: { id: linkedId },
            select: { name: true, slug: true },
          })
          .then((world) =>
            world ? { title: world.name, slug: world.slug } : null,
          );
      case 'character':
        return this.prisma.character
          .findUnique({
            where: { id: linkedId },
            select: { name: true, slug: true },
          })
          .then((character) =>
            character ? { title: character.name, slug: character.slug } : null,
          );
      case 'series':
        return this.prisma.series.findUnique({
          where: { id: linkedId },
          select: { title: true, slug: true },
        });
      default:
        return null;
    }
  }

  private async findSectionOrThrow(boardId: string, sectionId: string) {
    const section = await this.prisma.visualBoardSection.findFirst({
      where: { id: sectionId, boardId },
    });
    if (!section) {
      throw new NotFoundException('Seccion no encontrada');
    }
    return section;
  }

  private async findItemOrThrow(sectionId: string, itemId: string) {
    const item = await this.prisma.visualBoardItem.findFirst({
      where: { id: itemId, sectionId },
    });
    if (!item) {
      throw new NotFoundException('Imagen no encontrada');
    }
    return item;
  }

  private async reindexSections(tx: Tx, boardId: string) {
    const sections = await tx.visualBoardSection.findMany({
      where: { boardId },
      orderBy: { orderIndex: 'asc' },
    });

    for (const [index, section] of sections.entries()) {
      await tx.visualBoardSection.update({
        where: { id: section.id },
        data: { orderIndex: -(index + 1) },
      });
    }

    for (const [index, section] of sections.entries()) {
      await tx.visualBoardSection.update({
        where: { id: section.id },
        data: { orderIndex: index + 1 },
      });
    }
  }

  private async reindexItems(tx: Tx, sectionId: string) {
    const items = await tx.visualBoardItem.findMany({
      where: { sectionId },
      orderBy: { orderIndex: 'asc' },
    });

    for (const [index, item] of items.entries()) {
      await tx.visualBoardItem.update({
        where: { id: item.id },
        data: { orderIndex: -(index + 1) },
      });
    }

    for (const [index, item] of items.entries()) {
      await tx.visualBoardItem.update({
        where: { id: item.id },
        data: { orderIndex: index + 1 },
      });
    }
  }

  private validateReorderSet(
    existingIds: string[],
    requestedIds: string[],
    label: string,
  ) {
    if (existingIds.length !== requestedIds.length) {
      throw new UnprocessableEntityException(
        `Debes incluir todas las ${label} en el reorden.`,
      );
    }

    const existing = new Set(existingIds);
    const requested = new Set(requestedIds);

    if (requested.size !== requestedIds.length) {
      throw new UnprocessableEntityException(
        `La lista de ${label} contiene ids duplicados.`,
      );
    }

    for (const id of requestedIds) {
      if (!existing.has(id)) {
        throw new UnprocessableEntityException(
          `Una o mas ${label} no pertenecen al recurso indicado.`,
        );
      }
    }
  }

  private async touchBoard(tx: Tx, boardId: string) {
    await tx.visualBoard.update({
      where: { id: boardId },
      data: { updatedAt: new Date() },
    });
  }
}
