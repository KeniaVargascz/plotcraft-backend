import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { NovelType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class NovelCharacterLinkService {
  constructor(private readonly prisma: PrismaService) {}

  async linkNovelCharacter(
    slug: string,
    userId: string,
    dto: {
      characterId?: string;
      communityCharacterId?: string;
      roleInNovel?: any;
    },
  ) {
    const novel = await this.findOwnedNovel(slug, userId);

    const hasChar = !!dto.characterId;
    const hasCC = !!dto.communityCharacterId;
    if (!hasChar && !hasCC) {
      throw new BadRequestException({ statusCode: 400, message: 'You must provide characterId or communityCharacterId', code: 'CHARACTER_ID_REQUIRED' });
    }
    if (hasChar && hasCC) {
      throw new BadRequestException({ statusCode: 400, message: 'Cannot provide both characterId and communityCharacterId', code: 'CHARACTER_ID_CONFLICT' });
    }

    if (hasCC) {
      if (novel.novelType !== NovelType.FANFIC) {
        throw new UnprocessableEntityException({ statusCode: 422, message: 'Only fanfics can link community catalog characters', code: 'COMMUNITY_CHAR_FANFIC_ONLY' });
      }
      const cc = await this.prisma.communityCharacter.findUnique({
        where: { id: dto.communityCharacterId! },
      });
      if (!cc || cc.communityId !== novel.linkedCommunityId) {
        throw new UnprocessableEntityException({ statusCode: 422, message: 'This character does not belong to the novel fandom', code: 'COMMUNITY_CHAR_WRONG_FANDOM' });
      }
      if (cc.status !== 'ACTIVE') {
        throw new UnprocessableEntityException({ statusCode: 422, message: 'Only approved catalog characters can be linked', code: 'COMMUNITY_CHAR_NOT_APPROVED' });
      }

      const existing = await this.prisma.novelCharacter.findUnique({
        where: {
          novelId_communityCharacterId: {
            novelId: novel.id,
            communityCharacterId: cc.id,
          },
        },
      });
      if (existing) {
        return { linked: true, id: existing.id };
      }

      const created = await this.prisma.novelCharacter.create({
        data: {
          novelId: novel.id,
          communityCharacterId: cc.id,
          roleInNovel: dto.roleInNovel ?? null,
        },
      });
      return { linked: true, id: created.id };
    }

    // characterId path
    const character = await this.prisma.character.findUnique({
      where: { id: dto.characterId! },
    });
    if (!character) {
      throw new NotFoundException({ statusCode: 404, message: 'Character not found', code: 'CHARACTER_NOT_FOUND' });
    }
    if (character.authorId !== userId) {
      throw new ForbiddenException({ statusCode: 403, message: 'You can only link your own characters to your novels', code: 'CHARACTER_LINK_FORBIDDEN' });
    }

    const existing = await this.prisma.novelCharacter.findUnique({
      where: {
        novelId_characterId: {
          novelId: novel.id,
          characterId: character.id,
        },
      },
    });
    if (existing) {
      return { linked: true, id: existing.id };
    }
    const created = await this.prisma.novelCharacter.create({
      data: {
        novelId: novel.id,
        characterId: character.id,
        roleInNovel: dto.roleInNovel ?? character.role,
      },
    });
    return { linked: true, id: created.id };
  }

  async unlinkNovelCharacter(
    slug: string,
    userId: string,
    novelCharacterId: string,
  ) {
    const novel = await this.findOwnedNovel(slug, userId);
    const nc = await this.prisma.novelCharacter.findUnique({
      where: { id: novelCharacterId },
    });
    if (!nc || nc.novelId !== novel.id) {
      throw new NotFoundException({ statusCode: 404, message: 'Link not found', code: 'NOVEL_CHARACTER_LINK_NOT_FOUND' });
    }
    await this.prisma.novelCharacter.delete({ where: { id: nc.id } });
    return { unlinked: true };
  }

  async listNovelCharacters(
    slug: string,
    viewerId?: string | null,
    query: { cursor?: string; limit?: number } = {},
  ) {
    const novel = await this.findAccessibleNovel(slug, viewerId);
    const limit = query.limit ?? 20;

    const items = await this.prisma.novelCharacter.findMany({
      where: { novelId: novel.id },
      take: limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: [{ roleInNovel: 'asc' }],
      include: {
        character: {
          include: {
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
          },
        },
        communityCharacter: true,
      },
    });

    const hasMore = items.length > limit;
    const sliced = items.slice(0, limit);

    const data = sliced
      .map((item) => {
        if (item.communityCharacter) {
          return {
            id: item.communityCharacter.id,
            novelCharacterId: item.id,
            name: item.communityCharacter.name,
            slug: null,
            avatarUrl: item.communityCharacter.avatarUrl,
            description: item.communityCharacter.description,
            role: null,
            roleInNovel: item.roleInNovel ?? null,
            status: item.communityCharacter.status,
            isPublic: true,
            source: 'community' as const,
            communityCharacterId: item.communityCharacter.id,
            author: null,
            world: null,
          };
        }

        if (
          item.character &&
          (item.character.isPublic || item.character.authorId === viewerId)
        ) {
          const ch = item.character;
          return {
            id: ch.id,
            novelCharacterId: item.id,
            name: ch.name,
            slug: ch.slug,
            avatarUrl: ch.avatarUrl,
            description: null,
            role: ch.role,
            roleInNovel: item.roleInNovel ?? ch.role,
            status: ch.status,
            isPublic: ch.isPublic,
            source: 'character' as const,
            communityCharacterId: null,
            author: {
              id: ch.author.id,
              username: ch.author.username,
              displayName: ch.author.profile?.displayName ?? ch.author.username,
              avatarUrl: ch.author.profile?.avatarUrl ?? null,
            },
            world:
              ch.world &&
              (ch.world.visibility === 'PUBLIC' || ch.authorId === viewerId)
                ? ch.world
                : null,
          };
        }

        return null;
      })
      .filter(Boolean);

    return {
      data,
      pagination: {
        nextCursor: hasMore ? (sliced.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  private async findOwnedNovel(slug: string, userId: string) {
    const novel = await this.prisma.novel.findUnique({
      where: { slug },
    });

    if (!novel) {
      throw new NotFoundException({ statusCode: 404, message: 'Novel not found', code: 'NOVEL_NOT_FOUND' });
    }

    if (novel.authorId !== userId) {
      throw new ForbiddenException({ statusCode: 403, message: 'You cannot manage this novel', code: 'NOVEL_FORBIDDEN' });
    }

    return novel;
  }

  private async findAccessibleNovel(slug: string, viewerId?: string | null) {
    const novel = await this.prisma.novel.findUnique({
      where: { slug },
    });

    if (!novel) {
      throw new NotFoundException({ statusCode: 404, message: 'Novel not found', code: 'NOVEL_NOT_FOUND' });
    }

    if (!novel.isPublic && novel.authorId !== viewerId) {
      throw new NotFoundException({ statusCode: 404, message: 'Novel not found', code: 'NOVEL_NOT_FOUND' });
    }

    return novel;
  }
}
