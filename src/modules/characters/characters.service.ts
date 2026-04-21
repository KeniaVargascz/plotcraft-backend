import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CharacterRole,
  CharacterStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { generateUniqueSlug } from '../../common/utils/unique-slug.util';
import { WorldsService } from '../worlds/worlds.service';
import { CharacterQueryDto } from './dto/character-query.dto';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';

type CharacterListOptions = {
  viewerId?: string | null;
  authorId?: string;
  authorUsername?: string;
  onlyPublic?: boolean;
  worldSlug?: string;
  query: CharacterQueryDto;
};

@Injectable()
export class CharactersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly worldsService: WorldsService,
  ) {}

  async create(userId: string, dto: CreateCharacterDto) {
    const slug = await this.generateUniqueSlug(userId, dto.name);
    const worldId = await this.resolveOwnedWorldId(userId, dto.worldId);

    const character = await this.prisma.character.create({
      data: {
        authorId: userId,
        worldId,
        name: dto.name.trim(),
        slug,
        alias: dto.alias?.map((item) => item.trim()).filter(Boolean) ?? [],
        role: dto.role ?? CharacterRole.SECONDARY,
        status: dto.status ?? CharacterStatus.ALIVE,
        age: dto.age?.trim() || null,
        appearance: dto.appearance?.trim() || null,
        personality: dto.personality?.trim() || null,
        motivations: dto.motivations?.trim() || null,
        fears: dto.fears?.trim() || null,
        strengths: dto.strengths?.trim() || null,
        weaknesses: dto.weaknesses?.trim() || null,
        backstory: dto.backstory?.trim() || null,
        arc: dto.arc?.trim() || null,
        avatarUrl: dto.avatarUrl?.trim() || null,
        isPublic: dto.isPublic ?? false,
        tags: dto.tags?.map((item) => item.trim()).filter(Boolean) ?? [],
        metadata:
          (dto.metadata as Prisma.InputJsonValue | undefined) ??
          Prisma.JsonNull,
      },
    });

    return this.getDetail(
      (await this.prisma.user.findUniqueOrThrow({ where: { id: userId } }))
        .username,
      character.slug,
      userId,
    );
  }

  listPublic(query: CharacterQueryDto, viewerId?: string | null) {
    return this.listCharacters({ query, viewerId, onlyPublic: true });
  }

  listMine(userId: string, query: CharacterQueryDto) {
    return this.listCharacters({ query, viewerId: userId, authorId: userId });
  }

  listByUser(
    username: string,
    query: CharacterQueryDto,
    viewerId?: string | null,
  ) {
    return this.listCharacters({
      query,
      viewerId,
      authorUsername: username,
      onlyPublic: true,
    });
  }

  listByWorld(
    worldSlug: string,
    query: CharacterQueryDto,
    viewerId?: string | null,
  ) {
    return this.listCharacters({
      query,
      viewerId,
      worldSlug,
      onlyPublic: true,
    });
  }

  async getDetail(
    authorUsername: string,
    slug: string,
    viewerId?: string | null,
  ) {
    const character = await this.findCharacter(authorUsername, slug, viewerId);
    const response = this.toCharacterResponse(character, viewerId, true);
    const isOwner = character.authorId === viewerId;

    if (viewerId && !isOwner && response.viewerContext) {
      const kudo = await this.prisma.characterKudo.findUnique({
        where: {
          characterId_userId: { characterId: character.id, userId: viewerId },
        },
      });
      (response.viewerContext as any).hasKudo = !!kudo;
    }

    return response;
  }

  async update(
    userId: string,
    authorUsername: string,
    slug: string,
    dto: UpdateCharacterDto,
  ) {
    const character = await this.findOwnedCharacter(
      userId,
      authorUsername,
      slug,
    );
    const nextName = dto.name?.trim() ?? character.name;
    const worldId =
      dto.worldId !== undefined
        ? await this.resolveOwnedWorldId(userId, dto.worldId)
        : character.worldId;

    const updated = await this.prisma.character.update({
      where: { id: character.id },
      data: {
        ...(dto.name !== undefined
          ? {
              name: nextName,
              slug:
                nextName !== character.name
                  ? await this.generateUniqueSlug(
                      userId,
                      nextName,
                      character.id,
                    )
                  : character.slug,
            }
          : {}),
        ...(dto.worldId !== undefined ? { worldId } : {}),
        ...(dto.alias !== undefined
          ? {
              alias: dto.alias
                .map((item: string) => item.trim())
                .filter(Boolean),
            }
          : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.age !== undefined ? { age: dto.age?.trim() || null } : {}),
        ...(dto.appearance !== undefined
          ? { appearance: dto.appearance?.trim() || null }
          : {}),
        ...(dto.personality !== undefined
          ? { personality: dto.personality?.trim() || null }
          : {}),
        ...(dto.motivations !== undefined
          ? { motivations: dto.motivations?.trim() || null }
          : {}),
        ...(dto.fears !== undefined
          ? { fears: dto.fears?.trim() || null }
          : {}),
        ...(dto.strengths !== undefined
          ? { strengths: dto.strengths?.trim() || null }
          : {}),
        ...(dto.weaknesses !== undefined
          ? { weaknesses: dto.weaknesses?.trim() || null }
          : {}),
        ...(dto.backstory !== undefined
          ? { backstory: dto.backstory?.trim() || null }
          : {}),
        ...(dto.arc !== undefined ? { arc: dto.arc?.trim() || null } : {}),
        ...(dto.avatarUrl !== undefined
          ? { avatarUrl: dto.avatarUrl?.trim() || null }
          : {}),
        ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
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

    return this.getDetail(authorUsername, updated.slug, userId);
  }

  async remove(userId: string, authorUsername: string, slug: string) {
    const character = await this.findOwnedCharacter(
      userId,
      authorUsername,
      slug,
    );
    await this.prisma.character.delete({ where: { id: character.id } });
    return { message: 'Personaje eliminado correctamente' };
  }

  async findOwnedCharacter(
    userId: string,
    authorUsername: string,
    slug: string,
  ) {
    const character = await this.prisma.character.findFirst({
      where: {
        slug,
        authorId: userId,
        author: { username: authorUsername },
      },
    });

    if (!character) {
      throw new NotFoundException('Personaje no encontrado');
    }

    return character;
  }

  private async findCharacter(
    authorUsername: string,
    slug: string,
    viewerId?: string | null,
  ) {
    const character = await this.prisma.character.findFirst({
      where: {
        slug,
        author: { username: authorUsername },
      },
      include: this.characterInclude(),
    });

    if (!character) {
      throw new NotFoundException('Personaje no encontrado');
    }

    if (!character.isPublic && character.authorId !== viewerId) {
      throw new NotFoundException('Personaje no encontrado');
    }

    return character;
  }

  private async listCharacters(options: CharacterListOptions) {
    const limit = options.query.limit ?? 12;
    const worldFilter = options.worldSlug
      ? await this.resolveWorldFilter(options.worldSlug, options.viewerId)
      : null;

    const where: Prisma.CharacterWhereInput = {
      ...(options.authorId ? { authorId: options.authorId } : {}),
      ...(options.authorUsername
        ? {
            author: {
              username: options.authorUsername,
            },
          }
        : {}),
      ...(options.onlyPublic ? { isPublic: true } : {}),
      ...(options.query.role ? { role: options.query.role } : {}),
      ...(options.query.status ? { status: options.query.status } : {}),
      ...(worldFilter ? { worldId: worldFilter.id } : {}),
      ...(options.query.worldSlug && !worldFilter
        ? { world: { slug: options.query.worldSlug } }
        : {}),
      ...(options.query.search
        ? {
            OR: [
              { name: { contains: options.query.search, mode: 'insensitive' } },
              {
                personality: {
                  contains: options.query.search,
                  mode: 'insensitive',
                },
              },
              {
                tags: {
                  hasSome: [options.query.search],
                },
              },
            ],
          }
        : {}),
    };

    const page = options.query.page ?? null;

    if (page) {
      const [characters, total] = await Promise.all([
        this.prisma.character.findMany({
          where,
          take: limit,
          skip: (page - 1) * limit,
          orderBy: this.resolveOrderBy(options.query.sort),
          include: this.characterInclude(),
        }),
        this.prisma.character.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: characters.map((character) =>
          this.toCharacterResponse(character, options.viewerId),
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

    const characters = await this.prisma.character.findMany({
      where,
      take: limit + 1,
      ...(options.query.cursor
        ? { skip: 1, cursor: { id: options.query.cursor } }
        : {}),
      orderBy: this.resolveOrderBy(options.query.sort),
      include: this.characterInclude(),
    });

    const hasMore = characters.length > limit;
    const items = characters.slice(0, limit);

    return {
      data: items.map((character) =>
        this.toCharacterResponse(character, options.viewerId),
      ),
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
    sort?: CharacterQueryDto['sort'],
  ): Prisma.CharacterOrderByWithRelationInput[] {
    if (sort === 'name') {
      return [{ name: 'asc' }];
    }

    if (sort === 'updated') {
      return [{ updatedAt: 'desc' }];
    }

    return [{ createdAt: 'desc' }];
  }

  private characterInclude() {
    return {
      author: {
        include: {
          profile: true,
        },
      },
      world: {
        select: {
          id: true,
          name: true,
          slug: true,
          visibility: true,
        },
      },
      novelCharacters: {
        include: {
          novel: {
            select: {
              id: true,
              title: true,
              slug: true,
              isPublic: true,
              authorId: true,
            },
          },
        },
      },
      relationshipsAsSource: {
        include: this.relationshipInclude(),
      },
      _count: {
        select: {
          relationshipsAsSource: true,
          novelCharacters: true,
        },
      },
    } satisfies Prisma.CharacterInclude;
  }

  private relationshipInclude() {
    return {
      source: {
        include: {
          author: { include: { profile: true } },
        },
      },
      target: {
        include: {
          author: { include: { profile: true } },
          world: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    } satisfies Prisma.CharacterRelationshipInclude;
  }

  private toCharacterResponse(
    character: Prisma.CharacterGetPayload<{
      include: ReturnType<CharactersService['characterInclude']>;
    }>,
    viewerId?: string | null,
    includeRelations = false,
  ) {
    const isOwner = character.authorId === viewerId;
    const linkedNovels = character.novelCharacters.filter(
      (item) => item.novel.isPublic || item.novel.authorId === viewerId,
    );

    return {
      id: character.id,
      name: character.name,
      slug: character.slug,
      alias: character.alias,
      role: character.role,
      status: character.status,
      age: character.age,
      appearance: character.appearance,
      personality: character.personality,
      motivations: character.motivations,
      fears: character.fears,
      strengths: character.strengths,
      weaknesses: character.weaknesses,
      backstory: character.backstory,
      arc: character.arc,
      avatarUrl: character.avatarUrl,
      isPublic: character.isPublic,
      tags: character.tags,
      metadata: character.metadata,
      createdAt: character.createdAt,
      updatedAt: character.updatedAt,
      author: {
        id: character.author.id,
        username: character.author.username,
        displayName:
          character.author.profile?.displayName ?? character.author.username,
        avatarUrl: character.author.profile?.avatarUrl ?? null,
      },
      world:
        character.world && (character.world.visibility === 'PUBLIC' || isOwner)
          ? character.world
          : null,
      stats: {
        relationshipsCount: character._count.relationshipsAsSource,
        novelsCount: linkedNovels.length,
        kudosCount: character.kudosCount,
      },
      viewerContext: viewerId
        ? {
            isOwner,
            hasKudo: false,
          }
        : null,
      ...(includeRelations
        ? {
            relationshipsPreview: character.relationshipsAsSource
              .filter(
                (item) =>
                  item.target.isPublic || item.target.authorId === viewerId,
              )
              .slice(0, 6)
              .map((item) => this.toRelationshipResponse(item)),
            linkedNovels: linkedNovels.map((item) => ({
              id: item.novel.id,
              title: item.novel.title,
              slug: item.novel.slug,
              isPublic: item.novel.isPublic,
            })),
          }
        : {}),
    };
  }

  private toRelationshipResponse(
    relationship: Prisma.CharacterRelationshipGetPayload<{
      include: ReturnType<CharactersService['relationshipInclude']>;
    }>,
  ) {
    return {
      id: relationship.id,
      type: relationship.type,
      label: relationship.type,
      category: relationship.category,
      kinshipType: relationship.kinshipType,
      relationshipGroupId: relationship.relationshipGroupId,
      description: relationship.description,
      isMutual: relationship.isMutual,
      createdAt: relationship.createdAt,
      source: {
        id: relationship.source.id,
        name: relationship.source.name,
        slug: relationship.source.slug,
        username: relationship.source.author.username,
      },
      target: {
        id: relationship.target.id,
        name: relationship.target.name,
        slug: relationship.target.slug,
        username: relationship.target.author.username,
        avatarUrl: relationship.target.avatarUrl,
        world: relationship.target.world,
      },
    };
  }

  private async resolveOwnedWorldId(userId: string, worldId?: string | null) {
    if (worldId === undefined) {
      return undefined;
    }

    if (worldId === null) {
      return null;
    }

    const world = await this.prisma.world.findFirst({
      where: {
        id: worldId,
        authorId: userId,
      },
    });

    if (!world) {
      throw new NotFoundException('Mundo no encontrado');
    }

    return world.id;
  }

  private async resolveWorldFilter(
    worldSlug: string,
    viewerId?: string | null,
  ) {
    const world = await this.worldsService.getWorldEntity(worldSlug, viewerId);
    return world;
  }

  private async generateUniqueSlug(
    userId: string,
    name: string,
    ignoreCharacterId?: string,
  ) {
    return generateUniqueSlug(this.prisma, {
      title: name,
      model: 'character',
      scope: { authorId: userId },
      ignoreId: ignoreCharacterId,
    });
  }
}
