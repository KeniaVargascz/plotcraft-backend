import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { NovelType, Prisma, WorldVisibility } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NovelsService } from '../novels/novels.service';
import { createSlug } from '../novels/utils/slugify.util';
import { generateUniqueSlug } from '../../common/utils/unique-slug.util';
import { CreateLocationDto } from './dto/create-location.dto';
import { CreateWorldDto } from './dto/create-world.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateWorldDto } from './dto/update-world.dto';
import { WorldQueryDto } from './dto/world-query.dto';

type WorldListOptions = {
  authorId?: string;
  authorUsername?: string;
  viewerId?: string | null;
  onlyPublic?: boolean;
  query: WorldQueryDto;
};

@Injectable()
export class WorldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly novelsService: NovelsService,
  ) {}

  async create(userId: string, dto: CreateWorldDto) {
    const slug = await this.generateUniqueSlug(dto.name);
    const world = await this.prisma.world.create({
      data: {
        authorId: userId,
        name: dto.name.trim(),
        slug,
        tagline: dto.tagline?.trim() || null,
        description: dto.description?.trim() || null,
        setting: dto.setting?.trim() || null,
        magicSystem: dto.magicSystem?.trim() || null,
        rules: dto.rules?.trim() || null,
        coverUrl: dto.coverUrl?.trim() || null,
        mapUrl: dto.mapUrl?.trim() || null,
        genre: dto.genre ?? null,
        visibility: dto.visibility ?? WorldVisibility.PRIVATE,
        tags: dto.tags?.map((item) => item.trim()).filter(Boolean) ?? [],
        metadata:
          (dto.metadata as Prisma.InputJsonValue | undefined) ??
          Prisma.JsonNull,
      },
    });

    return this.getBySlug(world.slug, userId);
  }

  listPublic(query: WorldQueryDto, viewerId?: string | null) {
    return this.listWorlds({ query, viewerId, onlyPublic: true });
  }

  listMine(userId: string, query: WorldQueryDto) {
    return this.listWorlds({ query, viewerId: userId, authorId: userId });
  }

  listByUser(username: string, query: WorldQueryDto, viewerId?: string | null) {
    return this.listWorlds({
      query,
      viewerId,
      authorUsername: username,
      onlyPublic: true,
    });
  }

  async getBySlug(slug: string, viewerId?: string | null) {
    const world = await this.prisma.world.findUnique({
      where: { slug },
      include: this.worldInclude(),
    });

    if (!world) {
      throw new NotFoundException('Mundo no encontrado');
    }

    if (
      world.visibility === WorldVisibility.PRIVATE &&
      world.authorId !== viewerId
    ) {
      throw new NotFoundException('Mundo no encontrado');
    }

    const response = this.toWorldResponse(world, viewerId, true);
    const isOwner = world.authorId === viewerId;

    if (viewerId && !isOwner && response.viewerContext) {
      const kudo = await this.prisma.worldKudo.findUnique({
        where: { worldId_userId: { worldId: world.id, userId: viewerId } },
      });
      (response.viewerContext as any).hasKudo = !!kudo;
    }

    return response;
  }

  async update(userId: string, slug: string, dto: UpdateWorldDto) {
    const world = await this.findOwnedWorld(userId, slug);
    const nextName = dto.name?.trim() ?? world.name;

    const updated = await this.prisma.world.update({
      where: { id: world.id },
      data: {
        ...(dto.name !== undefined
          ? {
              name: nextName,
              slug:
                nextName !== world.name
                  ? await this.generateUniqueSlug(nextName, world.id)
                  : world.slug,
            }
          : {}),
        ...(dto.tagline !== undefined
          ? { tagline: dto.tagline?.trim() || null }
          : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.setting !== undefined
          ? { setting: dto.setting?.trim() || null }
          : {}),
        ...(dto.magicSystem !== undefined
          ? { magicSystem: dto.magicSystem?.trim() || null }
          : {}),
        ...(dto.rules !== undefined
          ? { rules: dto.rules?.trim() || null }
          : {}),
        ...(dto.coverUrl !== undefined
          ? { coverUrl: dto.coverUrl?.trim() || null }
          : {}),
        ...(dto.mapUrl !== undefined
          ? { mapUrl: dto.mapUrl?.trim() || null }
          : {}),
        ...(dto.genre !== undefined ? { genre: dto.genre } : {}),
        ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
        ...(dto.tags !== undefined
          ? {
              tags: dto.tags.map((item: string) => item.trim()).filter(Boolean),
            }
          : {}),
        ...(dto.metadata !== undefined
          ? {
              metadata:
                (dto.metadata as Prisma.InputJsonValue | undefined) ??
                Prisma.JsonNull,
            }
          : {}),
      },
    });

    return this.getBySlug(updated.slug, userId);
  }

  async remove(userId: string, slug: string) {
    const world = await this.findOwnedWorld(userId, slug);
    await this.prisma.world.delete({ where: { id: world.id } });
    return { message: 'Mundo eliminado correctamente' };
  }

  async createLocation(userId: string, slug: string, dto: CreateLocationDto) {
    const world = await this.findOwnedWorld(userId, slug);

    return this.prisma.worldLocation.create({
      data: {
        worldId: world.id,
        name: dto.name.trim(),
        type: dto.type.trim(),
        description: dto.description?.trim() || null,
        isNotable: dto.isNotable ?? false,
      },
    });
  }

  async updateLocation(
    userId: string,
    slug: string,
    locationId: string,
    dto: UpdateLocationDto,
  ) {
    const world = await this.findOwnedWorld(userId, slug);
    const location = await this.prisma.worldLocation.findFirst({
      where: { id: locationId, worldId: world.id },
    });

    if (!location) {
      throw new NotFoundException('Ubicacion no encontrada');
    }

    return this.prisma.worldLocation.update({
      where: { id: location.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.type !== undefined ? { type: dto.type.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.isNotable !== undefined ? { isNotable: dto.isNotable } : {}),
      },
    });
  }

  async removeLocation(userId: string, slug: string, locationId: string) {
    const world = await this.findOwnedWorld(userId, slug);
    const location = await this.prisma.worldLocation.findFirst({
      where: { id: locationId, worldId: world.id },
    });

    if (!location) {
      throw new NotFoundException('Ubicacion no encontrada');
    }

    await this.prisma.worldLocation.delete({ where: { id: location.id } });
    return { message: 'Ubicacion eliminada correctamente' };
  }

  async linkNovel(userId: string, slug: string, novelSlug: string) {
    const world = await this.findOwnedWorld(userId, slug);
    const novel = await this.novelsService.findOwnedNovel(novelSlug, userId);

    if (novel.novelType === NovelType.FANFIC && !novel.isAlternateUniverse) {
      throw new UnprocessableEntityException(
        'Solo los fanfics marcados como AU pueden tener mundos vinculados.',
      );
    }

    await this.prisma.novelWorld.upsert({
      where: {
        novelId_worldId: {
          novelId: novel.id,
          worldId: world.id,
        },
      },
      update: {},
      create: {
        novelId: novel.id,
        worldId: world.id,
      },
    });

    return { linked: true };
  }

  async unlinkNovel(userId: string, slug: string, novelSlug: string) {
    const world = await this.findOwnedWorld(userId, slug);
    const novel = await this.novelsService.findOwnedNovel(novelSlug, userId);

    await this.prisma.novelWorld.deleteMany({
      where: {
        novelId: novel.id,
        worldId: world.id,
      },
    });

    return { linked: false };
  }

  async listLinkedNovels(
    slug: string,
    viewerId?: string | null,
    query: { cursor?: string; limit?: number } = {},
  ) {
    const world = await this.getWorldEntity(slug, viewerId);
    const limit = query.limit ?? 12;

    const rows = await this.prisma.novelWorld.findMany({
      where: {
        worldId: world.id,
        novel: {
          OR: [
            { isPublic: true },
            ...(viewerId ? [{ authorId: viewerId }] : []),
          ],
        },
      },
      take: limit + 1,
      ...(query.cursor
        ? {
            skip: 1,
            cursor: {
              novelId_worldId: { novelId: query.cursor, worldId: world.id },
            },
          }
        : {}),
      orderBy: { novel: { updatedAt: 'desc' } },
      include: {
        novel: {
          include: {
            author: { include: { profile: true } },
            genres: { include: { genre: true } },
            _count: {
              select: {
                chapters: true,
                likes: true,
                bookmarks: true,
              },
            },
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    return {
      data: items.map((item) => ({
        id: item.novel.id,
        title: item.novel.title,
        slug: item.novel.slug,
        synopsis: item.novel.synopsis,
        coverUrl: item.novel.coverUrl,
        status: item.novel.status,
        rating: item.novel.rating,
        isPublic: item.novel.isPublic,
        wordCount: item.novel.wordCount,
        updatedAt: item.novel.updatedAt,
        author: {
          id: item.novel.author.id,
          username: item.novel.author.username,
          displayName:
            item.novel.author.profile?.displayName ??
            item.novel.author.username,
          avatarUrl: item.novel.author.profile?.avatarUrl ?? null,
        },
        genres: item.novel.genres.map((genreItem) => ({
          id: genreItem.genre.id,
          slug: genreItem.genre.slug,
          label: genreItem.genre.label,
        })),
        stats: {
          chaptersCount: item.novel._count.chapters,
          likesCount: item.novel._count.likes,
          bookmarksCount: item.novel._count.bookmarks,
        },
      })),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.novelId ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  async findOwnedWorld(userId: string, slug: string) {
    const world = await this.prisma.world.findUnique({ where: { slug } });

    if (!world) {
      throw new NotFoundException('Mundo no encontrado');
    }

    if (world.authorId !== userId) {
      throw new ForbiddenException('No puedes gestionar este mundo');
    }

    return world;
  }

  async getWorldEntity(slug: string, viewerId?: string | null) {
    const world = await this.prisma.world.findUnique({ where: { slug } });

    if (!world) {
      throw new NotFoundException('Mundo no encontrado');
    }

    if (
      world.visibility === WorldVisibility.PRIVATE &&
      world.authorId !== viewerId
    ) {
      throw new NotFoundException('Mundo no encontrado');
    }

    return world;
  }

  private async listWorlds(options: WorldListOptions) {
    const limit = options.query.limit ?? 12;
    const where: Prisma.WorldWhereInput = {
      ...(options.authorId ? { authorId: options.authorId } : {}),
      ...(options.authorUsername
        ? {
            author: {
              username: options.authorUsername,
            },
          }
        : {}),
      ...(options.onlyPublic ? { visibility: WorldVisibility.PUBLIC } : {}),
      ...(options.query.visibility
        ? { visibility: options.query.visibility }
        : {}),
      ...(options.query.search
        ? {
            OR: [
              { name: { contains: options.query.search, mode: 'insensitive' } },
              {
                tagline: {
                  contains: options.query.search,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: options.query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const page = options.query.page ?? null;

    if (page) {
      const [worlds, total] = await Promise.all([
        this.prisma.world.findMany({
          where,
          take: limit,
          skip: (page - 1) * limit,
          orderBy: this.resolveOrderBy(options.query.sort),
          include: this.worldInclude(),
        }),
        this.prisma.world.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: worlds.map((world) =>
          this.toWorldResponse(world, options.viewerId),
        ),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages,
          nextCursor: null,
        },
      };
    }

    const worlds = await this.prisma.world.findMany({
      where,
      take: limit + 1,
      ...(options.query.cursor
        ? { skip: 1, cursor: { id: options.query.cursor } }
        : {}),
      orderBy: this.resolveOrderBy(options.query.sort),
      include: this.worldInclude(),
    });

    const hasMore = worlds.length > limit;
    const items = worlds.slice(0, limit);

    return {
      data: items.map((world) => this.toWorldResponse(world, options.viewerId)),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
        page: null,
        total: null,
        totalPages: null,
      },
    };
  }

  private resolveOrderBy(
    sort?: WorldQueryDto['sort'],
  ): Prisma.WorldOrderByWithRelationInput[] {
    if (sort === 'name') {
      return [{ name: 'asc' }];
    }

    if (sort === 'updated') {
      return [{ updatedAt: 'desc' }];
    }

    return [{ createdAt: 'desc' }];
  }

  private worldInclude() {
    return {
      author: {
        include: {
          profile: true,
        },
      },
      locations: {
        orderBy: [{ isNotable: 'desc' as const }, { name: 'asc' as const }],
      },
      novelWorlds: {
        include: {
          novel: {
            select: {
              id: true,
              title: true,
              slug: true,
              isPublic: true,
              coverUrl: true,
              authorId: true,
            },
          },
        },
      },
      wbCategories: {
        orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
        include: {
          _count: { select: { entries: true } },
        },
      },
      _count: {
        select: {
          locations: true,
          characters: true,
          novelWorlds: true,
          wbEntries: true,
        },
      },
    } satisfies Prisma.WorldInclude;
  }

  private toWorldResponse(
    world: Prisma.WorldGetPayload<{
      include: ReturnType<WorldsService['worldInclude']>;
    }>,
    viewerId?: string | null,
    includeRelations = false,
  ) {
    const isOwner = world.authorId === viewerId;
    const linkedNovels = world.novelWorlds.filter(
      (item) => item.novel.isPublic || item.novel.authorId === viewerId,
    );

    return {
      id: world.id,
      name: world.name,
      slug: world.slug,
      tagline: world.tagline,
      description: world.description,
      setting: world.setting,
      magicSystem: world.magicSystem,
      rules: world.rules,
      coverUrl: world.coverUrl,
      mapUrl: world.mapUrl,
      genre: world.genre,
      visibility: world.visibility,
      tags: world.tags,
      metadata: world.metadata,
      createdAt: world.createdAt,
      updatedAt: world.updatedAt,
      author: {
        id: world.author.id,
        username: world.author.username,
        displayName: world.author.profile?.displayName ?? world.author.username,
        avatarUrl: world.author.profile?.avatarUrl ?? null,
      },
      stats: {
        locationsCount: world._count.locations,
        charactersCount: world._count.characters,
        novelsCount: linkedNovels.length,
        kudosCount: world.kudosCount,
      },
      wbSummary: {
        categoriesCount: world.wbCategories.length,
        entriesCount: world._count.wbEntries,
        publicEntriesCount: world.wbCategories.reduce(
          (sum, cat) => sum + cat._count.entries,
          0,
        ),
        categories: world.wbCategories.map((cat) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          icon: cat.icon,
          color: cat.color,
          entriesCount: cat._count.entries,
        })),
      },
      viewerContext: viewerId
        ? {
            isOwner,
            hasKudo: false,
          }
        : null,
      ...(includeRelations
        ? {
            locations: world.locations,
            linkedNovels: linkedNovels.map((item) => ({
              id: item.novel.id,
              title: item.novel.title,
              slug: item.novel.slug,
              coverUrl: item.novel.coverUrl,
              isPublic: item.novel.isPublic,
            })),
          }
        : {}),
    };
  }

  private async generateUniqueSlug(name: string, ignoreWorldId?: string) {
    return generateUniqueSlug(this.prisma, {
      title: name,
      model: 'world',
      ignoreId: ignoreWorldId,
    });
  }
}
