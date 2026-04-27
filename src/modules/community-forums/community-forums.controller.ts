import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { FeatureFlag } from '../../config/feature-flags.constants';
import { AuthService } from '../auth/auth.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CommunityForumsService } from './community-forums.service';
import { CreateForumDto } from './dto/create-forum.dto';
import { CreateForumThreadDto } from './dto/create-thread.dto';
import { UpdateForumDto } from './dto/update-forum.dto';
import { ForumThreadsService } from './forum-threads.service';

@ApiTags('community-forums')
@RequireFeature(FeatureFlag.COMMUNITY_COMMUNITIES_FORUMS)
@Controller()
export class CommunityForumsController {
  constructor(
    private readonly forumsService: CommunityForumsService,
    private readonly threadsService: ForumThreadsService,
    private readonly authService: AuthService,
  ) {}

  // ── Forum CRUD ──

  @Public()
  @Get('communities/:slug/forums')
  @ApiOperation({ summary: 'Listar foros de una comunidad' })
  async listForums(
    @Param('slug') slug: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.forumsService.listForums(slug, viewer?.sub ?? null);
  }

  @Public()
  @Get('communities/:slug/discussed-threads')
  @ApiOperation({
    summary: 'Hilos de foros mas comentados/votados que mencionan la comunidad',
  })
  listDiscussedThreads(
    @Param('slug') slug: string,
    @Query('limit') limit?: string,
  ) {
    return this.threadsService.listDiscussedThreadsForCommunity(
      slug,
      limit ? Number.parseInt(limit, 10) : 5,
    );
  }

  @ApiBearerAuth()
  @Post('communities/:slug/forums')
  @ApiOperation({ summary: 'Crear foro en una comunidad' })
  createForum(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateForumDto,
  ) {
    return this.forumsService.createForum(slug, user.sub, dto);
  }

  @ApiBearerAuth()
  @Patch('communities/:slug/forums/:forumSlug')
  @ApiOperation({ summary: 'Actualizar foro' })
  updateForum(
    @Param('slug') slug: string,
    @Param('forumSlug') forumSlug: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateForumDto,
  ) {
    return this.forumsService.updateForum(slug, forumSlug, user.sub, dto);
  }

  @ApiBearerAuth()
  @Delete('communities/:slug/forums/:forumSlug')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar foro' })
  async deleteForum(
    @Param('slug') slug: string,
    @Param('forumSlug') forumSlug: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.forumsService.deleteForum(slug, forumSlug, user.sub);
    return null;
  }

  // ── Membership ──

  @ApiBearerAuth()
  @Post('communities/:slug/forums/:forumSlug/join')
  @ApiOperation({ summary: 'Unirse a un foro' })
  joinForum(
    @Param('slug') slug: string,
    @Param('forumSlug') forumSlug: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.forumsService.joinForum(slug, forumSlug, user.sub);
  }

  @ApiBearerAuth()
  @Delete('communities/:slug/forums/:forumSlug/leave')
  @ApiOperation({ summary: 'Abandonar un foro' })
  leaveForum(
    @Param('slug') slug: string,
    @Param('forumSlug') forumSlug: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.forumsService.leaveForum(slug, forumSlug, user.sub);
  }

  // ── Threads ──

  @Public()
  @Get('communities/:slug/forums/:forumSlug/threads')
  @ApiOperation({ summary: 'Listar hilos de un foro' })
  async listThreads(
    @Param('slug') slug: string,
    @Param('forumSlug') forumSlug: string,
    @Query('sortBy') sortBy?: 'newest' | 'most_replies' | 'most_reactions',
    @Query('cursor') cursor?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.threadsService.listThreads(
      slug,
      forumSlug,
      viewer?.sub ?? null,
      sortBy ?? 'newest',
      cursor,
    );
  }

  @Public()
  @Get('communities/:slug/forums/:forumSlug/threads/:threadSlug')
  @ApiOperation({ summary: 'Detalle de un hilo' })
  async getThread(
    @Param('slug') slug: string,
    @Param('forumSlug') forumSlug: string,
    @Param('threadSlug') threadSlug: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.threadsService.getThread(
      slug,
      forumSlug,
      threadSlug,
      viewer?.sub ?? null,
    );
  }

  @ApiBearerAuth()
  @Post('communities/:slug/forums/:forumSlug/threads')
  @ApiOperation({ summary: 'Crear hilo en un foro' })
  createThread(
    @Param('slug') slug: string,
    @Param('forumSlug') forumSlug: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateForumThreadDto,
  ) {
    return this.threadsService.createThread(slug, forumSlug, user.sub, dto);
  }
}
