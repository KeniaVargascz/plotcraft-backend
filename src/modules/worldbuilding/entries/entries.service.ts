import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorldsService } from '../../worlds/worlds.service';
import { createSlug } from '../../novels/utils/slugify.util';
import type { FieldDefinition } from '../constants/category-templates.const';
import { validateFields } from '../utils/field-validator.util';
import { CreateEntryDto } from './dto/create-entry.dto';
import { CreateLinkDto } from './dto/create-link.dto';
import { EntryQueryDto } from './dto/entry-query.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';

@Injectable()
export class EntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly worldsService: WorldsService,
  ) {}

  async listEntries(worldSlug: string, query: EntryQueryDto) {
    const world = await this.getWorldBySlug(worldSlug);
    const limit = query.limit ?? 20;

    const where: Prisma.WbEntryWhereInput = {
      worldId: world.id,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.isPublic !== undefined ? { isPublic: query.isPublic } : {}),
      ...(query.tags && query.tags.length > 0 ? { tags: { hasSome: query.tags } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { summary: { contains: query.search, mode: 'insensitive' as const } },
              { tags: { hasSome: query.search.split(' ').filter(Boolean) } },
            ],
          }
        : {}),
    };

    const entries = await this.prisma.wbEntry.findMany({
      where,
      take: limit + 1,
      ...(query.cursor
        ? { skip: 1, cursor: { id: query.cursor } }
        : {}),
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        category: { select: { id: true, name: true, slug: true, icon: true, color: true } },
        author: { include: { profile: true } },
        _count: { select: { linksAsSource: true, linksAsTarget: true } },
      },
    });

    const hasMore = entries.length > limit;
    const items = entries.slice(0, limit);

    return {
      data: items.map((entry) => this.toEntrySummary(entry)),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  async getEntry(worldSlug: string, entrySlug: string) {
    const world = await this.getWorldBySlug(worldSlug);

    const entry = await this.prisma.wbEntry.findUnique({
      where: { worldId_slug: { worldId: world.id, slug: entrySlug } },
      include: {
        category: { select: { id: true, name: true, slug: true, icon: true, color: true, fieldSchema: true } },
        author: { include: { profile: true } },
        linksAsSource: {
          include: {
            target: {
              select: { id: true, name: true, slug: true, summary: true },
            },
          },
        },
        linksAsTarget: {
          include: {
            source: {
              select: { id: true, name: true, slug: true, summary: true },
            },
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException('Entrada no encontrada');
    }

    return {
      id: entry.id,
      worldId: entry.worldId,
      categoryId: entry.categoryId,
      authorId: entry.authorId,
      name: entry.name,
      slug: entry.slug,
      summary: entry.summary,
      content: entry.content,
      coverUrl: entry.coverUrl,
      fields: entry.fields,
      tags: entry.tags,
      isPublic: entry.isPublic,
      sortOrder: entry.sortOrder,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      category: entry.category,
      author: {
        id: entry.author.id,
        username: entry.author.username,
        displayName: entry.author.profile?.displayName ?? entry.author.username,
        avatarUrl: entry.author.profile?.avatarUrl ?? null,
      },
      links: [
        ...entry.linksAsSource.map((link) => ({
          id: link.id,
          direction: 'outgoing' as const,
          relation: link.relation,
          isMutual: link.isMutual,
          entry: link.target,
          createdAt: link.createdAt,
        })),
        ...entry.linksAsTarget.map((link) => ({
          id: link.id,
          direction: 'incoming' as const,
          relation: link.relation,
          isMutual: link.isMutual,
          entry: link.source,
          createdAt: link.createdAt,
        })),
      ],
    };
  }

  async listEntriesByCategory(worldSlug: string, catSlug: string, query: EntryQueryDto) {
    const world = await this.getWorldBySlug(worldSlug);

    const category = await this.prisma.wbCategory.findUnique({
      where: { worldId_slug: { worldId: world.id, slug: catSlug } },
    });

    if (!category) {
      throw new NotFoundException('Categoria no encontrada');
    }

    return this.listEntries(worldSlug, { ...query, categoryId: category.id });
  }

  async create(userId: string, worldSlug: string, dto: CreateEntryDto) {
    const world = await this.worldsService.findOwnedWorld(userId, worldSlug);

    const category = await this.prisma.wbCategory.findFirst({
      where: { id: dto.categoryId, worldId: world.id },
    });

    if (!category) {
      throw new NotFoundException('Categoria no encontrada en este mundo');
    }

    const schema = (category.fieldSchema as unknown as FieldDefinition[]) || [];
    if (dto.fields) {
      validateFields(dto.fields, schema);
    }

    const slug = await this.generateUniqueEntrySlug(world.id, dto.name);

    const maxOrder = await this.prisma.wbEntry.aggregate({
      where: { worldId: world.id, categoryId: category.id },
      _max: { sortOrder: true },
    });

    const entry = await this.prisma.wbEntry.create({
      data: {
        worldId: world.id,
        categoryId: category.id,
        authorId: userId,
        name: dto.name.trim(),
        slug,
        summary: dto.summary?.trim() ?? null,
        content: dto.content ?? null,
        coverUrl: dto.coverUrl?.trim() ?? null,
        fields: (dto.fields ?? {}) as Prisma.InputJsonValue,
        tags: dto.tags?.map((t) => t.trim()).filter(Boolean) ?? [],
        isPublic: dto.isPublic ?? false,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
      include: {
        category: { select: { id: true, name: true, slug: true, icon: true, color: true } },
        author: { include: { profile: true } },
        _count: { select: { linksAsSource: true, linksAsTarget: true } },
      },
    });

    return this.toEntrySummary(entry);
  }

  async update(
    userId: string,
    worldSlug: string,
    entrySlug: string,
    dto: UpdateEntryDto,
  ) {
    const world = await this.worldsService.findOwnedWorld(userId, worldSlug);

    const entry = await this.prisma.wbEntry.findUnique({
      where: { worldId_slug: { worldId: world.id, slug: entrySlug } },
      include: { category: true },
    });

    if (!entry) {
      throw new NotFoundException('Entrada no encontrada');
    }

    if (dto.fields) {
      const schema =
        (entry.category.fieldSchema as unknown as FieldDefinition[]) || [];
      validateFields(dto.fields, schema);
    }

    let newSlug = entry.slug;
    if (dto.name !== undefined && dto.name.trim() !== entry.name) {
      newSlug = await this.generateUniqueEntrySlug(world.id, dto.name, entry.id);
    }

    const updated = await this.prisma.wbEntry.update({
      where: { id: entry.id },
      data: {
        ...(dto.name !== undefined
          ? { name: dto.name.trim(), slug: newSlug }
          : {}),
        ...(dto.summary !== undefined
          ? { summary: dto.summary?.trim() ?? null }
          : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.coverUrl !== undefined
          ? { coverUrl: dto.coverUrl?.trim() ?? null }
          : {}),
        ...(dto.fields !== undefined
          ? { fields: dto.fields as Prisma.InputJsonValue }
          : {}),
        ...(dto.tags !== undefined
          ? { tags: dto.tags.map((t) => t.trim()).filter(Boolean) }
          : {}),
        ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
      },
      include: {
        category: { select: { id: true, name: true, slug: true, icon: true, color: true } },
        author: { include: { profile: true } },
        _count: { select: { linksAsSource: true, linksAsTarget: true } },
      },
    });

    return this.toEntrySummary(updated);
  }

  async remove(userId: string, worldSlug: string, entrySlug: string) {
    const world = await this.worldsService.findOwnedWorld(userId, worldSlug);

    const entry = await this.prisma.wbEntry.findUnique({
      where: { worldId_slug: { worldId: world.id, slug: entrySlug } },
    });

    if (!entry) {
      throw new NotFoundException('Entrada no encontrada');
    }

    await this.prisma.wbEntry.delete({ where: { id: entry.id } });
    return { message: 'Entrada eliminada correctamente' };
  }

  async reorderEntries(
    userId: string,
    worldSlug: string,
    catSlug: string,
    items: Array<{ id: string; order: number }>,
  ) {
    const world = await this.worldsService.findOwnedWorld(userId, worldSlug);

    const category = await this.prisma.wbCategory.findUnique({
      where: { worldId_slug: { worldId: world.id, slug: catSlug } },
    });

    if (!category) {
      throw new NotFoundException('Categoria no encontrada');
    }

    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.wbEntry.updateMany({
          where: { id: item.id, worldId: world.id, categoryId: category.id },
          data: { sortOrder: item.order },
        }),
      ),
    );

    return { reordered: true };
  }

  async createLink(
    userId: string,
    worldSlug: string,
    entrySlug: string,
    dto: CreateLinkDto,
  ) {
    const world = await this.worldsService.findOwnedWorld(userId, worldSlug);

    const sourceEntry = await this.prisma.wbEntry.findUnique({
      where: { worldId_slug: { worldId: world.id, slug: entrySlug } },
    });

    if (!sourceEntry) {
      throw new NotFoundException('Entrada de origen no encontrada');
    }

    const targetEntry = await this.prisma.wbEntry.findFirst({
      where: { id: dto.targetId, worldId: world.id },
    });

    if (!targetEntry) {
      throw new NotFoundException('Entrada de destino no encontrada en este mundo');
    }

    if (sourceEntry.id === targetEntry.id) {
      throw new BadRequestException('Una entrada no puede vincularse consigo misma');
    }

    const link = await this.prisma.wbEntryLink.create({
      data: {
        sourceId: sourceEntry.id,
        targetId: targetEntry.id,
        relation: dto.relation.trim(),
        isMutual: dto.isMutual ?? false,
      },
      include: {
        source: { select: { id: true, name: true, slug: true } },
        target: { select: { id: true, name: true, slug: true } },
      },
    });

    if (dto.isMutual) {
      const reverseExists = await this.prisma.wbEntryLink.findUnique({
        where: {
          sourceId_targetId_relation: {
            sourceId: targetEntry.id,
            targetId: sourceEntry.id,
            relation: dto.relation.trim(),
          },
        },
      });

      if (!reverseExists) {
        await this.prisma.wbEntryLink.create({
          data: {
            sourceId: targetEntry.id,
            targetId: sourceEntry.id,
            relation: dto.relation.trim(),
            isMutual: true,
          },
        });
      }
    }

    return {
      id: link.id,
      sourceId: link.sourceId,
      targetId: link.targetId,
      relation: link.relation,
      isMutual: link.isMutual,
      createdAt: link.createdAt,
      source: link.source,
      target: link.target,
    };
  }

  async deleteLink(
    userId: string,
    worldSlug: string,
    entrySlug: string,
    linkId: string,
  ) {
    const world = await this.worldsService.findOwnedWorld(userId, worldSlug);

    const entry = await this.prisma.wbEntry.findUnique({
      where: { worldId_slug: { worldId: world.id, slug: entrySlug } },
    });

    if (!entry) {
      throw new NotFoundException('Entrada no encontrada');
    }

    const link = await this.prisma.wbEntryLink.findFirst({
      where: { id: linkId, sourceId: entry.id },
    });

    if (!link) {
      throw new NotFoundException('Vinculo no encontrado');
    }

    await this.prisma.wbEntryLink.delete({ where: { id: link.id } });

    if (link.isMutual) {
      await this.prisma.wbEntryLink.deleteMany({
        where: {
          sourceId: link.targetId,
          targetId: link.sourceId,
          relation: link.relation,
        },
      });
    }

    return { message: 'Vinculo eliminado correctamente' };
  }

  async listLinks(worldSlug: string, entrySlug: string) {
    const world = await this.getWorldBySlug(worldSlug);

    const entry = await this.prisma.wbEntry.findUnique({
      where: { worldId_slug: { worldId: world.id, slug: entrySlug } },
    });

    if (!entry) {
      throw new NotFoundException('Entrada no encontrada');
    }

    const [outgoing, incoming] = await Promise.all([
      this.prisma.wbEntryLink.findMany({
        where: { sourceId: entry.id },
        include: {
          target: {
            select: { id: true, name: true, slug: true, summary: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.wbEntryLink.findMany({
        where: { targetId: entry.id },
        include: {
          source: {
            select: { id: true, name: true, slug: true, summary: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      outgoing: outgoing.map((link) => ({
        id: link.id,
        relation: link.relation,
        isMutual: link.isMutual,
        entry: link.target,
        createdAt: link.createdAt,
      })),
      incoming: incoming.map((link) => ({
        id: link.id,
        relation: link.relation,
        isMutual: link.isMutual,
        entry: link.source,
        createdAt: link.createdAt,
      })),
    };
  }

  async searchEntries(worldSlug: string, q: string, limit = 20) {
    const world = await this.getWorldBySlug(worldSlug);

    if (!q || q.trim().length < 2) {
      return { data: [] };
    }

    const sanitized = q
      .trim()
      .replace(/[&|!:()'"]/g, ' ')
      .replace(/\s+/g, ' ');
    const terms = sanitized
      .split(' ')
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);

    if (terms.length === 0) {
      return { data: [] };
    }

    const useFullText = terms.every((t) => t.length >= 3);

    if (!useFullText) {
      const entries = await this.prisma.wbEntry.findMany({
        where: {
          worldId: world.id,
          OR: [
            { name: { contains: sanitized, mode: 'insensitive' } },
            { summary: { contains: sanitized, mode: 'insensitive' } },
            { tags: { hasSome: terms } },
          ],
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true, slug: true, icon: true, color: true } },
          author: { include: { profile: true } },
          _count: { select: { linksAsSource: true, linksAsTarget: true } },
        },
      });

      return {
        data: entries.map((entry) => this.toEntrySummary(entry)),
      };
    }

    const tsquery = terms.join(' & ');
    const ilike = `%${sanitized}%`;

    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; score: number }>>(
      `
      SELECT e.id,
             CASE
               WHEN e.search_vector @@ to_tsquery('spanish', $1)
                 THEN ts_rank(e.search_vector, to_tsquery('spanish', $1))
               ELSE 0.05
             END AS score
      FROM wb_entries e
      WHERE e.world_id = $2::uuid
        AND (
          e.search_vector @@ to_tsquery('spanish', $1)
          OR e.name ILIKE $3
          OR COALESCE(e.summary, '') ILIKE $3
        )
      ORDER BY score DESC, e.created_at DESC
      LIMIT $4
      `,
      tsquery,
      world.id,
      ilike,
      limit,
    );

    if (rows.length === 0) {
      return { data: [] };
    }

    const entries = await this.prisma.wbEntry.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      include: {
        category: { select: { id: true, name: true, slug: true, icon: true, color: true } },
        author: { include: { profile: true } },
        _count: { select: { linksAsSource: true, linksAsTarget: true } },
      },
    });

    const byId = new Map(entries.map((e) => [e.id, e]));

    return {
      data: rows
        .map((r) => byId.get(r.id))
        .filter((e): e is NonNullable<typeof e> => Boolean(e))
        .map((entry) => this.toEntrySummary(entry)),
    };
  }

  private toEntrySummary(
    entry: Prisma.WbEntryGetPayload<{
      include: {
        category: {
          select: { id: true; name: true; slug: true; icon: true; color: true };
        };
        author: { include: { profile: true } };
        _count: { select: { linksAsSource: true; linksAsTarget: true } };
      };
    }>,
  ) {
    return {
      id: entry.id,
      worldId: entry.worldId,
      categoryId: entry.categoryId,
      name: entry.name,
      slug: entry.slug,
      summary: entry.summary,
      coverUrl: entry.coverUrl,
      tags: entry.tags,
      isPublic: entry.isPublic,
      sortOrder: entry.sortOrder,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      category: entry.category,
      author: {
        id: entry.author.id,
        username: entry.author.username,
        displayName: entry.author.profile?.displayName ?? entry.author.username,
        avatarUrl: entry.author.profile?.avatarUrl ?? null,
      },
      linksCount:
        entry._count.linksAsSource + entry._count.linksAsTarget,
    };
  }

  private async getWorldBySlug(slug: string) {
    const world = await this.prisma.world.findUnique({ where: { slug } });
    if (!world) {
      throw new NotFoundException('Mundo no encontrado');
    }
    return world;
  }

  private async generateUniqueEntrySlug(
    worldId: string,
    name: string,
    ignoreEntryId?: string,
  ): Promise<string> {
    const baseSlug = createSlug(name);

    if (!baseSlug) {
      throw new BadRequestException(
        'No se pudo generar un slug valido para la entrada',
      );
    }

    let candidate = baseSlug;
    let suffix = 2;

    while (true) {
      const existing = await this.prisma.wbEntry.findUnique({
        where: { worldId_slug: { worldId, slug: candidate } },
      });

      if (!existing || existing.id === ignoreEntryId) {
        return candidate;
      }

      candidate = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
  }
}
