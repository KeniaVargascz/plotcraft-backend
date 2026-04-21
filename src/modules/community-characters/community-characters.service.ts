import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Community,
  CommunityCharacterStatus,
  CommunityMemberRole,
  CommunityMemberStatus,
  CommunityStatus,
  CommunityType,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NOTIFICATIONS_SERVICE,
  INotificationsService,
} from '../notifications/notifications.interface';
import { CreateCommunityCharacterDto } from './dto/create-community-character.dto';
import { ReviewSuggestionDto } from './dto/review-suggestion.dto';
import { UpdateCommunityCharacterDto } from './dto/update-community-character.dto';

type Viewer = { id: string } | null;

@Injectable()
export class CommunityCharactersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATIONS_SERVICE)
    private readonly notificationsService: INotificationsService,
  ) {}

  private async getFandomCommunity(slug: string): Promise<Community> {
    const community = await this.prisma.community.findUnique({
      where: { slug },
    });
    if (!community) {
      throw new NotFoundException('Comunidad no encontrada.');
    }
    if (community.type !== CommunityType.FANDOM) {
      throw new BadRequestException('Esta comunidad no es de tipo Fandom.');
    }
    if (community.status !== CommunityStatus.ACTIVE) {
      throw new ForbiddenException('La comunidad no está activa.');
    }
    return community;
  }

  private async isOwnerOrMod(
    community: Community,
    userId: string,
  ): Promise<boolean> {
    if (community.ownerId === userId) return true;
    const member = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: { communityId: community.id, userId },
      },
    });
    return (
      !!member &&
      member.status === CommunityMemberStatus.ACTIVE &&
      (member.role === CommunityMemberRole.ADMIN ||
        member.role === CommunityMemberRole.MODERATOR)
    );
  }

  private async assertOwnerOrMod(
    community: Community,
    userId: string,
  ): Promise<void> {
    const ok = await this.isOwnerOrMod(community, userId);
    if (!ok) {
      throw new ForbiddenException(
        'Solo el creador o moderadores pueden realizar esta acción.',
      );
    }
  }

  private async isActiveMember(
    community: Community,
    userId: string,
  ): Promise<boolean> {
    if (community.ownerId === userId) return true;
    const member = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: { communityId: community.id, userId },
      },
    });
    return !!member && member.status === CommunityMemberStatus.ACTIVE;
  }

  private toResponse(
    cc: Prisma.CommunityCharacterGetPayload<{
      include: { suggestedBy: { include: { profile: true } } };
    }>,
  ) {
    return {
      id: cc.id,
      communityId: cc.communityId,
      name: cc.name,
      description: cc.description,
      avatarUrl: cc.avatarUrl,
      status: cc.status,
      suggestedById: cc.suggestedById,
      rejectionNote: cc.rejectionNote,
      createdAt: cc.createdAt,
      updatedAt: cc.updatedAt,
      suggestedBy: cc.suggestedBy
        ? {
            id: cc.suggestedBy.id,
            username: cc.suggestedBy.username,
            displayName:
              cc.suggestedBy.profile?.displayName ?? cc.suggestedBy.username,
            avatarUrl: cc.suggestedBy.profile?.avatarUrl ?? null,
          }
        : null,
    };
  }

  async list(
    slug: string,
    viewer: Viewer,
    options: {
      status?: CommunityCharacterStatus;
      search?: string;
      cursor?: string;
      limit?: number;
    },
  ) {
    const community = await this.getFandomCommunity(slug);
    const requestedStatus = options.status ?? CommunityCharacterStatus.ACTIVE;

    if (requestedStatus !== CommunityCharacterStatus.ACTIVE) {
      if (!viewer) {
        throw new ForbiddenException('Acción no permitida.');
      }
      await this.assertOwnerOrMod(community, viewer.id);
    }

    const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
    const where: Prisma.CommunityCharacterWhereInput = {
      communityId: community.id,
      status: requestedStatus,
      ...(options.search
        ? { name: { contains: options.search, mode: 'insensitive' } }
        : {}),
    };

    const items = await this.prisma.communityCharacter.findMany({
      where,
      take: limit + 1,
      ...(options.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
      orderBy:
        requestedStatus === CommunityCharacterStatus.SUGGESTED
          ? { createdAt: 'asc' }
          : { name: 'asc' },
      include: { suggestedBy: { include: { profile: true } } },
    });

    const hasMore = items.length > limit;
    const trimmed = items.slice(0, limit);

    return {
      items: trimmed.map((cc) => this.toResponse(cc)),
      pagination: {
        nextCursor: hasMore ? (trimmed.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  async getOne(slug: string, charId: string, viewer: Viewer) {
    const community = await this.getFandomCommunity(slug);
    const cc = await this.prisma.communityCharacter.findUnique({
      where: { id: charId },
      include: { suggestedBy: { include: { profile: true } } },
    });
    if (!cc || cc.communityId !== community.id) {
      throw new NotFoundException('Personaje no encontrado.');
    }

    if (cc.status !== CommunityCharacterStatus.ACTIVE) {
      if (!viewer) {
        throw new ForbiddenException('Acción no permitida.');
      }
      const isMod = await this.isOwnerOrMod(community, viewer.id);
      const isSuggester = cc.suggestedById === viewer.id;
      if (!isMod && !isSuggester) {
        throw new ForbiddenException('Acción no permitida.');
      }
    }

    return this.toResponse(cc);
  }

  async create(slug: string, userId: string, dto: CreateCommunityCharacterDto) {
    const community = await this.getFandomCommunity(slug);

    const isMember = await this.isActiveMember(community, userId);
    if (!isMember) {
      throw new ForbiddenException(
        'Solo los miembros de la comunidad pueden crear o sugerir personajes.',
      );
    }

    const isMod = await this.isOwnerOrMod(community, userId);
    const status = isMod
      ? CommunityCharacterStatus.ACTIVE
      : CommunityCharacterStatus.SUGGESTED;

    const created = await this.prisma.communityCharacter.create({
      data: {
        communityId: community.id,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        avatarUrl: dto.avatarUrl?.trim() || null,
        status,
        suggestedById: isMod ? null : userId,
      },
      include: { suggestedBy: { include: { profile: true } } },
    });

    return this.toResponse(created);
  }

  async update(
    slug: string,
    charId: string,
    userId: string,
    dto: UpdateCommunityCharacterDto,
  ) {
    const community = await this.getFandomCommunity(slug);
    const cc = await this.prisma.communityCharacter.findUnique({
      where: { id: charId },
    });
    if (!cc || cc.communityId !== community.id) {
      throw new NotFoundException('Personaje no encontrado.');
    }

    const isMod = await this.isOwnerOrMod(community, userId);
    const isSuggesterEditingOwn =
      !isMod &&
      cc.status === CommunityCharacterStatus.SUGGESTED &&
      cc.suggestedById === userId;

    if (!isMod && !isSuggesterEditingOwn) {
      throw new ForbiddenException('Acción no permitida.');
    }

    const updated = await this.prisma.communityCharacter.update({
      where: { id: cc.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.avatarUrl !== undefined
          ? { avatarUrl: dto.avatarUrl?.trim() || null }
          : {}),
      },
      include: { suggestedBy: { include: { profile: true } } },
    });

    return this.toResponse(updated);
  }

  async remove(slug: string, charId: string, userId: string) {
    const community = await this.getFandomCommunity(slug);
    const cc = await this.prisma.communityCharacter.findUnique({
      where: { id: charId },
    });
    if (!cc || cc.communityId !== community.id) {
      throw new NotFoundException('Personaje no encontrado.');
    }
    await this.assertOwnerOrMod(community, userId);

    await this.prisma.communityCharacter.delete({ where: { id: cc.id } });
    return null;
  }

  async approve(slug: string, charId: string, userId: string) {
    const community = await this.getFandomCommunity(slug);
    await this.assertOwnerOrMod(community, userId);

    const cc = await this.prisma.communityCharacter.findUnique({
      where: { id: charId },
    });
    if (!cc || cc.communityId !== community.id) {
      throw new NotFoundException('Personaje no encontrado.');
    }
    if (cc.status !== CommunityCharacterStatus.SUGGESTED) {
      throw new UnprocessableEntityException(
        'Este personaje no está pendiente de revisión.',
      );
    }

    const updated = await this.prisma.communityCharacter.update({
      where: { id: cc.id },
      data: {
        status: CommunityCharacterStatus.ACTIVE,
        rejectionNote: null,
      },
      include: { suggestedBy: { include: { profile: true } } },
    });

    if (cc.suggestedById) {
      await this.notificationsService.createNotification({
        userId: cc.suggestedById,
        type: NotificationType.SUGGESTION_APPROVED,
        title: 'Tu sugerencia fue aprobada',
        body: `Tu personaje "${updated.name}" fue aprobado en "${community.name}".`,
        actorId: userId,
      });
    }

    return this.toResponse(updated);
  }

  async reject(
    slug: string,
    charId: string,
    userId: string,
    dto: ReviewSuggestionDto,
  ) {
    const community = await this.getFandomCommunity(slug);
    await this.assertOwnerOrMod(community, userId);

    if (!dto.note || !dto.note.trim()) {
      throw new UnprocessableEntityException(
        'Debes indicar el motivo del rechazo.',
      );
    }

    const cc = await this.prisma.communityCharacter.findUnique({
      where: { id: charId },
    });
    if (!cc || cc.communityId !== community.id) {
      throw new NotFoundException('Personaje no encontrado.');
    }
    if (cc.status !== CommunityCharacterStatus.SUGGESTED) {
      throw new UnprocessableEntityException(
        'Este personaje no está pendiente de revisión.',
      );
    }

    const updated = await this.prisma.communityCharacter.update({
      where: { id: cc.id },
      data: {
        status: CommunityCharacterStatus.REJECTED,
        rejectionNote: dto.note.trim(),
      },
      include: { suggestedBy: { include: { profile: true } } },
    });

    if (cc.suggestedById) {
      await this.notificationsService.createNotification({
        userId: cc.suggestedById,
        type: NotificationType.SUGGESTION_REJECTED,
        title: 'Tu sugerencia fue rechazada',
        body: `Tu personaje "${updated.name}" fue rechazado en "${community.name}". Motivo: ${dto.note.trim()}`,
        actorId: userId,
      });
    }

    return this.toResponse(updated);
  }
}
