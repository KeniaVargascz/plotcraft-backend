import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { NOVELS_SERVICE, INovelsService } from '../../novels/novels.interface';

@Injectable()
export class CharacterNovelLinkService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOVELS_SERVICE)
    private readonly novelsService: INovelsService,
  ) {}

  async linkNovel(
    userId: string,
    authorUsername: string,
    slug: string,
    novelSlug: string,
  ) {
    const character = await this.findOwnedCharacter(
      userId,
      authorUsername,
      slug,
    );
    const novel = await this.novelsService.findOwnedNovel(novelSlug, userId);

    await this.prisma.novelCharacter.upsert({
      where: {
        novelId_characterId: {
          novelId: novel.id,
          characterId: character.id,
        },
      },
      update: {
        roleInNovel: character.role,
      },
      create: {
        novelId: novel.id,
        characterId: character.id,
        roleInNovel: character.role,
      },
    });

    return { linked: true };
  }

  async unlinkNovel(
    userId: string,
    authorUsername: string,
    slug: string,
    novelSlug: string,
  ) {
    const character = await this.findOwnedCharacter(
      userId,
      authorUsername,
      slug,
    );
    const novel = await this.novelsService.findOwnedNovel(novelSlug, userId);

    await this.prisma.novelCharacter.deleteMany({
      where: {
        novelId: novel.id,
        characterId: character.id,
      },
    });

    return { linked: false };
  }

  async listNovels(
    authorUsername: string,
    slug: string,
    viewerId?: string | null,
    query: { cursor?: string; limit?: number } = {},
  ) {
    const character = await this.findCharacter(authorUsername, slug, viewerId);
    const limit = query.limit ?? 12;

    const novels = await this.prisma.novelCharacter.findMany({
      where: {
        characterId: character.id,
        novel: {
          OR: [
            { isPublic: true },
            ...(viewerId ? [{ authorId: viewerId }] : []),
          ],
        },
      },
      take: limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
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

    const hasMore = novels.length > limit;
    const items = novels.slice(0, limit);

    return {
      data: items.map((item) => ({
        id: item.novel.id,
        title: item.novel.title,
        slug: item.novel.slug,
        synopsis: item.novel.synopsis,
        coverUrl: item.novel.coverUrl,
        status: item.novel.status,
        isPublic: item.novel.isPublic,
        updatedAt: item.novel.updatedAt,
        author: {
          id: item.novel.author.id,
          username: item.novel.author.username,
          displayName:
            item.novel.author.profile?.displayName ??
            item.novel.author.username,
          avatarUrl: item.novel.author.profile?.avatarUrl ?? null,
        },
        stats: {
          chaptersCount: item.novel._count.chapters,
          likesCount: item.novel._count.likes,
          bookmarksCount: item.novel._count.bookmarks,
        },
      })),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  async listByNovel(novelSlug: string, viewerId?: string | null) {
    const novel = await this.novelsService.findAccessibleNovel(
      novelSlug,
      viewerId,
    );

    const items = await this.prisma.novelCharacter.findMany({
      where: { novelId: novel.id },
      orderBy: [{ roleInNovel: 'asc' }, { character: { name: 'asc' } }],
      include: {
        character: {
          include: this.characterInclude(),
        },
      },
    });

    return items
      .filter(
        (
          item,
        ): item is typeof item & {
          character: NonNullable<typeof item.character>;
        } =>
          !!item.character &&
          (item.character.isPublic || item.character.authorId === viewerId),
      )
      .map((item) => ({
        ...this.toCharacterResponse(item.character, viewerId),
        roleInNovel: item.roleInNovel ?? item.character.role,
      }));
  }

  private async findOwnedCharacter(
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
    });

    if (!character) {
      throw new NotFoundException('Personaje no encontrado');
    }

    if (!character.isPublic && character.authorId !== viewerId) {
      throw new NotFoundException('Personaje no encontrado');
    }

    return character;
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
        include: {
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
        },
      },
      _count: {
        select: {
          relationshipsAsSource: true,
          novelCharacters: true,
        },
      },
    } satisfies Prisma.CharacterInclude;
  }

  private toCharacterResponse(
    character: Prisma.CharacterGetPayload<{
      include: ReturnType<CharacterNovelLinkService['characterInclude']>;
    }>,
    viewerId?: string | null,
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
    };
  }
}
