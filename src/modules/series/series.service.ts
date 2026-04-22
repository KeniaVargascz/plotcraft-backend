import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { NovelStatus, Prisma, SeriesStatus, SeriesType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { createSlug } from '../novels/utils/slugify.util';
import { generateUniqueSlug } from '../../common/utils/unique-slug.util';
import { AddNovelToSeriesDto } from './dto/add-novel-to-series.dto';
import { CreateSeriesDto } from './dto/create-series.dto';
import { ReorderNovelsDto } from './dto/reorder-novels.dto';
import { SeriesQueryDto } from './dto/series-query.dto';
import { UpdateSeriesDto } from './dto/update-series.dto';
import { UpdateSeriesStatusDto } from './dto/update-series-status.dto';

const TYPE_LIMITS: Partial<Record<SeriesType, number>> = {
  [SeriesType.TRILOGY]: 3,
  [SeriesType.DILOGY]: 2,
};

@Injectable()
export class SeriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listSeries(query: SeriesQueryDto, _viewerId?: string | null) {
    const limit = query.limit ?? 20;
    const where: Prisma.SeriesWhereInput = {
      ...(query.authorUsername
        ? { author: { username: query.authorUsername } }
        : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const page = query.page ?? null;

    if (page) {
      const [rows, total] = await Promise.all([
        this.prisma.series.findMany({
          where,
          take: limit,
          skip: (page - 1) * limit,
          orderBy: { createdAt: 'desc' },
          include: this.seriesInclude(),
        }),
        this.prisma.series.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: rows.map((s) => this.toSeriesResponse(s)),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages,
        },
      };
    }

    const rows = await this.prisma.series.findMany({
      where,
      take: limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: this.seriesInclude(),
    });

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    return {
      data: items.map((s) => this.toSeriesResponse(s)),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  async getSeriesBySlug(slug: string, _viewerId?: string | null) {
    const series = await this.prisma.series.findUnique({
      where: { slug },
      include: this.seriesInclude(),
    });
    if (!series) throw new NotFoundException('Serie no encontrada');
    return this.toSeriesResponse(series);
  }

  async createSeries(userId: string, dto: CreateSeriesDto) {
    const novelIds = dto.novelIds ?? [];
    const childSeriesIds = dto.childSeriesIds ?? [];

    // A collection must contain at least one novel or one child collection
    if (!novelIds.length && !childSeriesIds.length) {
      throw new UnprocessableEntityException(
        'Una coleccion debe contener al menos una novela o una coleccion hija.',
      );
    }

    // Verify all novels belong to the user and are not in another collection
    if (novelIds.length) {
      const novels = await this.prisma.novel.findMany({
        where: { id: { in: novelIds } },
        select: { id: true, authorId: true },
      });
      if (novels.length !== novelIds.length) {
        throw new NotFoundException('Una o mas novelas no existen.');
      }
      const notOwned = novels.find((n) => n.authorId !== userId);
      if (notOwned) {
        throw new ForbiddenException(
          'Solo puedes anadir tus propias novelas a una coleccion.',
        );
      }
      const linked = await this.prisma.seriesNovel.findMany({
        where: { novelId: { in: novelIds } },
      });
      if (linked.length) {
        throw new UnprocessableEntityException(
          'Una o mas novelas ya pertenecen a otra coleccion.',
        );
      }
      const seriesType = dto.type ?? SeriesType.SAGA;
      const limit = TYPE_LIMITS[seriesType];
      if (limit && novelIds.length > limit) {
        throw new UnprocessableEntityException(
          `Una coleccion ${seriesType} solo admite ${limit} novelas.`,
        );
      }
    }

    // Verify all child collections belong to the user
    if (childSeriesIds.length) {
      const children = await this.prisma.series.findMany({
        where: { id: { in: childSeriesIds } },
        select: { id: true, authorId: true },
      });
      if (children.length !== childSeriesIds.length) {
        throw new NotFoundException('Una o mas colecciones hijas no existen.');
      }
      const notOwned = children.find((c) => c.authorId !== userId);
      if (notOwned) {
        throw new ForbiddenException(
          'Solo puedes anidar tus propias colecciones.',
        );
      }
    }

    const slug = await this.generateUniqueSlug(dto.title);

    const series = await this.prisma.$transaction(async (tx) => {
      const created = await tx.series.create({
        data: {
          authorId: userId,
          title: dto.title.trim(),
          slug,
          description: dto.description?.trim() || null,
          type: dto.type ?? SeriesType.SAGA,
          coverUrl: dto.coverUrl?.trim() || null,
        },
      });

      if (novelIds.length) {
        await tx.seriesNovel.createMany({
          data: novelIds.map((novelId, index) => ({
            seriesId: created.id,
            novelId,
            orderIndex: index + 1,
          })),
        });
      }

      if (childSeriesIds.length) {
        await tx.series.updateMany({
          where: { id: { in: childSeriesIds } },
          data: { parentId: created.id },
        });
      }

      return tx.series.findUniqueOrThrow({
        where: { id: created.id },
        include: this.seriesInclude(),
      });
    });

    return this.toSeriesResponse(series);
  }

  async updateSeries(slug: string, userId: string, dto: UpdateSeriesDto) {
    const series = await this.findOwnedSeries(slug, userId);

    // Validate parent: must belong to same author and not be self/descendant
    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === series.id) {
        throw new BadRequestException(
          'Una coleccion no puede ser su propia padre.',
        );
      }
      const parent = await this.prisma.series.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent || parent.authorId !== userId) {
        throw new NotFoundException('Coleccion padre no encontrada');
      }
    }

    const updated = await this.prisma.series.update({
      where: { id: series.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.coverUrl !== undefined
          ? { coverUrl: dto.coverUrl?.trim() || null }
          : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
      },
      include: this.seriesInclude(),
    });
    return this.toSeriesResponse(updated);
  }

  async deleteSeries(slug: string, userId: string) {
    const series = await this.findOwnedSeries(slug, userId);
    await this.prisma.series.delete({ where: { id: series.id } });
    return { message: 'Serie eliminada correctamente' };
  }

  async addNovelToSeries(
    slug: string,
    userId: string,
    dto: AddNovelToSeriesDto,
  ) {
    const series = await this.findOwnedSeries(slug, userId);

    const novel = await this.prisma.novel.findUnique({
      where: { id: dto.novelId },
    });
    if (!novel) throw new NotFoundException('Novela no encontrada');
    if (novel.authorId !== userId) {
      throw new ForbiddenException(
        'Solo puedes anadir tus propias novelas a una serie.',
      );
    }

    const alreadyLinked = await this.prisma.seriesNovel.findFirst({
      where: { novelId: dto.novelId },
    });
    if (alreadyLinked) {
      throw new UnprocessableEntityException(
        'Esta novela ya pertenece a otra serie.',
      );
    }

    const currentCount = await this.prisma.seriesNovel.count({
      where: { seriesId: series.id },
    });
    const limit = TYPE_LIMITS[series.type];
    if (limit && currentCount >= limit) {
      throw new UnprocessableEntityException(
        `Esta serie tipo ${series.type} solo admite ${limit} novelas.`,
      );
    }

    const orderTaken = await this.prisma.seriesNovel.findUnique({
      where: {
        seriesId_orderIndex: {
          seriesId: series.id,
          orderIndex: dto.orderIndex,
        },
      },
    });
    if (orderTaken) {
      throw new UnprocessableEntityException(
        'Ya existe una novela con ese orderIndex en la serie.',
      );
    }

    await this.prisma.seriesNovel.create({
      data: {
        seriesId: series.id,
        novelId: dto.novelId,
        orderIndex: dto.orderIndex,
      },
    });

    return this.getSeriesBySlug(series.slug);
  }

  async removeNovelFromSeries(slug: string, userId: string, novelId: string) {
    const series = await this.findOwnedSeries(slug, userId);
    const link = await this.prisma.seriesNovel.findUnique({
      where: { seriesId_novelId: { seriesId: series.id, novelId } },
    });
    if (!link) throw new NotFoundException('Novela no encontrada en la serie');

    const wasDeleted = await this.prisma.$transaction(async (tx) => {
      await tx.seriesNovel.delete({
        where: { seriesId_novelId: { seriesId: series.id, novelId } },
      });
      const remaining = await tx.seriesNovel.findMany({
        where: { seriesId: series.id },
        orderBy: { orderIndex: 'asc' },
      });

      // Auto-delete the series when no novels remain (must contain >= 1 novel)
      if (remaining.length === 0) {
        await tx.series.delete({ where: { id: series.id } });
        return true;
      }

      // Two-phase reassignment to avoid unique constraint collisions
      for (let i = 0; i < remaining.length; i++) {
        await tx.seriesNovel.update({
          where: {
            seriesId_novelId: {
              seriesId: series.id,
              novelId: remaining[i].novelId,
            },
          },
          data: { orderIndex: -(i + 1) },
        });
      }
      for (let i = 0; i < remaining.length; i++) {
        await tx.seriesNovel.update({
          where: {
            seriesId_novelId: {
              seriesId: series.id,
              novelId: remaining[i].novelId,
            },
          },
          data: { orderIndex: i + 1 },
        });
      }
      return false;
    });

    if (wasDeleted) {
      return {
        deleted: true,
        message:
          'La coleccion fue eliminada porque era su ultimo libro. Las novelas no se eliminaron.',
      };
    }

    return this.getSeriesBySlug(series.slug);
  }

  async reorderNovels(slug: string, userId: string, dto: ReorderNovelsDto) {
    const series = await this.findOwnedSeries(slug, userId);
    const links = await this.prisma.seriesNovel.findMany({
      where: { seriesId: series.id },
    });

    if (dto.novels.length !== links.length) {
      throw new BadRequestException(
        'Debes incluir todas las novelas de la serie en el reorden',
      );
    }
    const seriesIds = new Set(links.map((l) => l.novelId));
    const reqIds = new Set(dto.novels.map((n) => n.novelId));
    if (reqIds.size !== dto.novels.length) {
      throw new BadRequestException('La lista contiene novelas duplicadas');
    }
    for (const n of dto.novels) {
      if (!seriesIds.has(n.novelId)) {
        throw new BadRequestException(
          'Una o mas novelas no pertenecen a esta serie',
        );
      }
    }
    const orderIndices = new Set(dto.novels.map((n) => n.orderIndex));
    if (orderIndices.size !== dto.novels.length) {
      throw new BadRequestException(
        'Los orderIndex no pueden estar duplicados',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const [i, n] of dto.novels.entries()) {
        await tx.seriesNovel.update({
          where: {
            seriesId_novelId: {
              seriesId: series.id,
              novelId: n.novelId,
            },
          },
          data: { orderIndex: -(i + 1) },
        });
      }
      for (const n of dto.novels) {
        await tx.seriesNovel.update({
          where: {
            seriesId_novelId: {
              seriesId: series.id,
              novelId: n.novelId,
            },
          },
          data: { orderIndex: n.orderIndex },
        });
      }
    });

    return this.getSeriesBySlug(series.slug);
  }

  async updateSeriesStatus(
    slug: string,
    userId: string,
    dto: UpdateSeriesStatusDto,
  ) {
    const series = await this.findOwnedSeries(slug, userId);

    if (dto.status === SeriesStatus.COMPLETED) {
      const links = await this.prisma.seriesNovel.findMany({
        where: { seriesId: series.id },
        include: { novel: { select: { status: true } } },
      });
      const required = TYPE_LIMITS[series.type];
      if (required && links.length !== required) {
        throw new UnprocessableEntityException(
          `Una serie ${series.type} debe tener ${required} novelas para marcarse como completada.`,
        );
      }
      if (required) {
        const allClosed = links.every(
          (l) =>
            l.novel.status === NovelStatus.COMPLETED ||
            l.novel.status === NovelStatus.ARCHIVED,
        );
        if (!allClosed) {
          throw new UnprocessableEntityException(
            'Todas las novelas de la serie deben estar completadas o archivadas.',
          );
        }
      }
    }

    const updated = await this.prisma.series.update({
      where: { id: series.id },
      data: { status: dto.status },
      include: this.seriesInclude(),
    });
    return this.toSeriesResponse(updated);
  }

  private async findOwnedSeries(slug: string, userId: string) {
    const series = await this.prisma.series.findUnique({ where: { slug } });
    if (!series) throw new NotFoundException('Serie no encontrada');
    if (series.authorId !== userId) {
      throw new ForbiddenException('No puedes gestionar esta serie');
    }
    return series;
  }

  private async generateUniqueSlug(title: string) {
    return generateUniqueSlug(this.prisma, {
      title,
      model: 'series',
    });
  }

  private seriesInclude() {
    return {
      author: { include: { profile: true } },
      parent: { select: { id: true, title: true, slug: true } },
      children: { select: { id: true, title: true, slug: true } },
      novels: {
        orderBy: { orderIndex: 'asc' as const },
        include: {
          novel: {
            select: {
              id: true,
              title: true,
              slug: true,
              coverUrl: true,
              status: true,
              chaptersCount: true,
              totalWordsCount: true,
            },
          },
        },
      },
    } satisfies Prisma.SeriesInclude;
  }

  private toSeriesResponse(
    series: Prisma.SeriesGetPayload<{
      include: ReturnType<SeriesService['seriesInclude']>;
    }>,
  ) {
    return {
      id: series.id,
      title: series.title,
      slug: series.slug,
      description: series.description,
      type: series.type,
      status: series.status,
      coverUrl: series.coverUrl,
      parentId: series.parentId,
      parent: series.parent ?? null,
      children: series.children ?? [],
      novelsCount: series.novels.length,
      author: {
        username: series.author.username,
        displayName:
          series.author.profile?.displayName ?? series.author.username,
        avatarUrl: series.author.profile?.avatarUrl ?? null,
      },
      novels: series.novels.map((sn) => ({
        orderIndex: sn.orderIndex,
        id: sn.novel.id,
        title: sn.novel.title,
        slug: sn.novel.slug,
        coverUrl: sn.novel.coverUrl,
        status: sn.novel.status,
        chaptersCount: sn.novel.chaptersCount,
        totalWordsCount: sn.novel.totalWordsCount,
      })),
      createdAt: series.createdAt,
      updatedAt: series.updatedAt,
    };
  }
}
