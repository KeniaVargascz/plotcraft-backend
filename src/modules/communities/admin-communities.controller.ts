import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommunityStatus } from '@prisma/client';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { AdminGuard } from '../../common/guards/admin.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { CommunitiesService } from './communities.service';
import { CommunityQueryDto } from './dto/community-query.dto';
import { ReviewCommunityDto } from './dto/review-community.dto';

@ApiTags('admin-communities')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@RequireFeature('community.communities')
@Controller('admin/communities')
export class AdminCommunitiesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communitiesService: CommunitiesService,
  ) {}

  @Get('pending')
  @ApiOperation({ summary: 'Listar comunidades pendientes de revision' })
  async listPending(@Query() query: CommunityQueryDto) {
    const limit = query.limit ?? 20;

    const rows = await this.prisma.community.findMany({
      where: { status: CommunityStatus.PENDING },
      take: limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: { createdAt: 'asc' },
      include: {
        owner: { include: { profile: true } },
        linkedNovel: {
          select: {
            title: true,
            slug: true,
            coverUrl: true,
            author: { select: { username: true } },
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    return {
      data: items.map((c) =>
        this.communitiesService.toResponse(c, {
          isMember: false,
          isFollowing: false,
          isOwner: false,
        }),
      ),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  @Post(':slug/approve')
  @ApiOperation({ summary: 'Aprobar comunidad pendiente' })
  async approve(@Param('slug') slug: string) {
    const community = await this.prisma.community.update({
      where: { slug },
      data: {
        status: CommunityStatus.ACTIVE,
        rejectionReason: null,
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: community.ownerId,
        type: 'COMMUNITY_APPROVED',
        title: 'Comunidad aprobada',
        body: `Tu comunidad "${community.name}" ha sido aprobada.`,
        url: `/comunidades/${community.slug}`,
      },
    });

    return this.communitiesService.findBySlug(
      community.slug,
      community.ownerId,
    );
  }

  @Post(':slug/reject')
  @ApiOperation({ summary: 'Rechazar comunidad pendiente' })
  async reject(@Param('slug') slug: string, @Body() dto: ReviewCommunityDto) {
    if (!dto.reason || !dto.reason.trim()) {
      throw new UnprocessableEntityException(
        'Debes indicar el motivo del rechazo.',
      );
    }

    const community = await this.prisma.community.update({
      where: { slug },
      data: {
        status: CommunityStatus.REJECTED,
        rejectionReason: dto.reason.trim(),
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: community.ownerId,
        type: 'COMMUNITY_REJECTED',
        title: 'Comunidad rechazada',
        body: `Tu comunidad "${community.name}" fue rechazada. Motivo: ${dto.reason.trim()}`,
        url: '/me/communities/owned',
      },
    });

    return {
      id: community.id,
      slug: community.slug,
      status: community.status,
      rejectionReason: community.rejectionReason,
    };
  }
}
