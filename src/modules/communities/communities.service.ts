import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CommunityMemberRole,
  CommunityMemberStatus,
  CommunityStatus,
  CommunityType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { createSlug } from '../novels/utils/slugify.util';
import { CommunityQueryDto } from './dto/community-query.dto';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';

const MIN_NOVEL_AGE_DAYS = 30;
const DEFAULT_MIN_FOLLOWERS_FOR_PRIVATE = 10;
const SETTING_MIN_FOLLOWERS_PRIVATE = 'community.private.minFollowers';

@Injectable()
export class CommunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getMinFollowersForPrivate(): Promise<number> {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: SETTING_MIN_FOLLOWERS_PRIVATE },
    });
    const parsed = setting ? Number.parseInt(setting.value, 10) : NaN;
    return Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : DEFAULT_MIN_FOLLOWERS_FOR_PRIVATE;
  }

  async findAll(query: CommunityQueryDto, viewerId?: string | null) {
    const limit = query.limit ?? 20;
    const where: Prisma.CommunityWhereInput = {
      status: CommunityStatus.ACTIVE,
      ...(query.type ? { type: query.type } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const rows = await this.prisma.community.findMany({
      where,
      take: limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: this.communityInclude(),
    });

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    const viewerCtxList = await Promise.all(
      items.map((c) => this.buildViewerContext(c.id, c.ownerId, viewerId)),
    );

    return {
      data: items.map((c, i) => this.toResponse(c, viewerCtxList[i])),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  async findBySlug(slug: string, viewerId?: string | null) {
    const community = await this.prisma.community.findUnique({
      where: { slug },
      include: this.communityInclude(),
    });
    if (!community) throw new NotFoundException('Comunidad no encontrada');
    if (community.status === CommunityStatus.REJECTED) {
      throw new NotFoundException('Comunidad no encontrada');
    }
    if (
      community.status === CommunityStatus.PENDING &&
      viewerId !== community.ownerId
    ) {
      throw new NotFoundException('Comunidad no encontrada');
    }

    const ctx = await this.buildViewerContext(
      community.id,
      community.ownerId,
      viewerId,
    );
    return this.toResponse(community, ctx);
  }

  async create(dto: CreateCommunityDto, ownerId: string) {
    const isPrivate = dto.type === CommunityType.PRIVATE;

    if (isPrivate) {
      if (!dto.linkedNovelId) {
        throw new UnprocessableEntityException(
          'Una comunidad privada debe estar vinculada a una novela.',
        );
      }
      const novel = await this.prisma.novel.findUnique({
        where: { id: dto.linkedNovelId },
      });
      if (!novel) {
        throw new NotFoundException('Novela no encontrada');
      }
      if (novel.authorId !== ownerId) {
        throw new ForbiddenException(
          'Solo puedes vincular tus propias novelas.',
        );
      }
      const ageMs = Date.now() - novel.createdAt.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays < MIN_NOVEL_AGE_DAYS) {
        throw new UnprocessableEntityException(
          `La novela debe tener al menos ${MIN_NOVEL_AGE_DAYS} dias de antiguedad para crear una comunidad privada.`,
        );
      }
      const minFollowers = await this.getMinFollowersForPrivate();
      const followers = await this.prisma.follow.count({
        where: { followingId: ownerId },
      });
      if (followers < minFollowers) {
        throw new UnprocessableEntityException(
          `Necesitas al menos ${minFollowers} seguidores para crear una comunidad privada.`,
        );
      }
    }

    const slug = await this.generateUniqueSlug(dto.name);
    const status = isPrivate
      ? CommunityStatus.ACTIVE
      : CommunityStatus.PENDING;

    const community = await this.prisma.$transaction(async (tx) => {
      const created = await tx.community.create({
        data: {
          ownerId,
          name: dto.name.trim(),
          slug,
          type: dto.type,
          status,
          description: dto.description?.trim() || null,
          rules: dto.rules?.trim() || null,
          coverUrl: isPrivate ? dto.coverUrl?.trim() || null : null,
          bannerUrl: isPrivate ? dto.bannerUrl?.trim() || null : null,
          linkedNovelId: isPrivate ? dto.linkedNovelId : null,
          membersCount: 1,
        },
      });

      await tx.communityMember.create({
        data: {
          communityId: created.id,
          userId: ownerId,
          role: CommunityMemberRole.ADMIN,
          status: CommunityMemberStatus.ACTIVE,
        },
      });

      return created;
    });

    if (!isPrivate) {
      const admins = await this.prisma.user.findMany({
        where: { isAdmin: true },
        select: { id: true },
      });
      if (admins.length) {
        await this.prisma.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            type: 'COMMUNITY_REVIEW' as const,
            title: 'Nueva comunidad pendiente',
            body: `La comunidad "${community.name}" esta esperando revision.`,
            url: '/admin/comunidades',
            actorId: ownerId,
          })),
        });
      }
    }

    return this.findBySlug(community.slug, ownerId);
  }

  async update(slug: string, dto: UpdateCommunityDto, userId: string) {
    const community = await this.prisma.community.findUnique({
      where: { slug },
    });
    if (!community) throw new NotFoundException('Comunidad no encontrada');
    if (community.ownerId !== userId) {
      throw new ForbiddenException('No puedes editar esta comunidad');
    }
    if (
      community.type !== CommunityType.PRIVATE &&
      community.status === CommunityStatus.ACTIVE
    ) {
      throw new ForbiddenException(
        'Las comunidades publicas y de fandom aprobadas solo pueden ser editadas por administradores.',
      );
    }

    await this.prisma.community.update({
      where: { id: community.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.rules !== undefined
          ? { rules: dto.rules?.trim() || null }
          : {}),
        ...(dto.coverUrl !== undefined
          ? { coverUrl: dto.coverUrl?.trim() || null }
          : {}),
        ...(dto.bannerUrl !== undefined
          ? { bannerUrl: dto.bannerUrl?.trim() || null }
          : {}),
      },
    });

    return this.findBySlug(community.slug, userId);
  }

  async delete(slug: string, userId: string, force?: boolean) {
    const community = await this.prisma.community.findUnique({
      where: { slug },
    });
    if (!community) throw new NotFoundException('Comunidad no encontrada');
    if (community.ownerId !== userId) {
      throw new ForbiddenException('No puedes eliminar esta comunidad');
    }
    if (
      community.type !== CommunityType.PRIVATE &&
      community.status === CommunityStatus.ACTIVE
    ) {
      throw new ForbiddenException(
        'Las comunidades publicas y de fandom aprobadas solo pueden ser eliminadas por administradores.',
      );
    }

    if (community.membersCount > 1 && !force) {
      throw new UnprocessableEntityException(
        'Esta comunidad tiene miembros activos. Confirma la eliminacion forzada.',
      );
    }

    await this.prisma.community.delete({ where: { id: community.id } });
    return { message: 'Comunidad eliminada correctamente' };
  }

  async findMyOwned(userId: string) {
    const rows = await this.prisma.community.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      include: this.communityInclude(),
    });

    const ctxList = await Promise.all(
      rows.map((c) => this.buildViewerContext(c.id, c.ownerId, userId)),
    );

    return rows.map((c, i) => this.toResponse(c, ctxList[i]));
  }

  // ── helpers ──

  private async generateUniqueSlug(name: string) {
    const base = createSlug(name);
    let candidate = base;
    let suffix = 2;
    while (true) {
      const existing = await this.prisma.community.findUnique({
        where: { slug: candidate },
      });
      if (!existing) return candidate;
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
  }

  private communityInclude() {
    return {
      owner: { include: { profile: true } },
      linkedNovel: {
        select: {
          authorId: true,
          isPublic: true,
          title: true,
          slug: true,
          coverUrl: true,
          author: { select: { username: true } },
        },
      },
    } satisfies Prisma.CommunityInclude;
  }

  private async buildViewerContext(
    communityId: string,
    ownerId: string,
    viewerId?: string | null,
  ) {
    if (!viewerId) {
      return {
        isMember: false,
        isFollowing: false,
        isOwner: false,
        isFollowingOwner: false,
      };
    }
    const [member, follow, ownerFollow] = await Promise.all([
      this.prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId, userId: viewerId } },
      }),
      this.prisma.communityFollow.findUnique({
        where: { communityId_userId: { communityId, userId: viewerId } },
      }),
      viewerId === ownerId
        ? Promise.resolve(null)
        : this.prisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: viewerId,
                followingId: ownerId,
              },
            },
          }),
    ]);
    return {
      isMember:
        !!member && member.status === CommunityMemberStatus.ACTIVE,
      isFollowing: !!follow,
      isOwner: viewerId === ownerId,
      isFollowingOwner: viewerId === ownerId || !!ownerFollow,
    };
  }

  toResponse(
    community: any,
    ctx: {
      isMember: boolean;
      isFollowing: boolean;
      isOwner: boolean;
      isFollowingOwner?: boolean;
    },
  ) {
    const hideOwner =
      community.type !== CommunityType.PRIVATE &&
      community.status === CommunityStatus.ACTIVE;
    const linkedNovelVisibilityKnown =
      !!community.linkedNovel &&
      typeof community.linkedNovel.isPublic === 'boolean';
    const canViewLinkedNovel =
      !!community.linkedNovel &&
      (!linkedNovelVisibilityKnown || community.linkedNovel.isPublic || ctx.isOwner);
    return {
      id: community.id,
      name: community.name,
      slug: community.slug,
      type: community.type,
      status: community.status,
      description: community.description,
      coverUrl: community.coverUrl,
      bannerUrl: community.bannerUrl,
      rules: community.rules,
      rejectionReason: community.rejectionReason,
      membersCount: community.membersCount,
      followersCount: community.followersCount,
      owner: hideOwner
        ? null
        : {
            username: community.owner.username,
            displayName:
              community.owner.profile?.displayName ?? community.owner.username,
            avatarUrl: community.owner.profile?.avatarUrl ?? null,
          },
      linkedNovel: community.linkedNovel && canViewLinkedNovel
        ? {
            title: community.linkedNovel.title,
            slug: community.linkedNovel.slug,
            coverUrl: community.linkedNovel.coverUrl,
            authorUsername: community.linkedNovel.author.username,
          }
        : null,
      isMember: ctx.isMember,
      isFollowing: ctx.isFollowing,
      isOwner: hideOwner ? false : ctx.isOwner,
      isFollowingOwner: ctx.isFollowingOwner ?? false,
      forums: [] as unknown[],
      createdAt: community.createdAt,
      updatedAt: community.updatedAt,
    };
  }
}
