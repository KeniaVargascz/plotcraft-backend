import {
  Body,
  Controller,
  Delete,
  Get,
  GoneException,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from '../auth/auth.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CommunitiesService } from './communities.service';
import { CommunityMembersService } from './community-members.service';
import { CommunityQueryDto } from './dto/community-query.dto';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';

@ApiTags('communities')
@Controller()
export class CommunitiesController {
  constructor(
    private readonly communitiesService: CommunitiesService,
    private readonly membersService: CommunityMembersService,
    private readonly authService: AuthService,
  ) {}

  // ── Public listings ──

  @Public()
  @Get('communities')
  @ApiOperation({ summary: 'Listado publico de comunidades activas' })
  async listAll(
    @Query() query: CommunityQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.communitiesService.findAll(query, viewer?.sub ?? null);
  }

  @Public()
  @Get('communities/:slug')
  @ApiOperation({ summary: 'Detalle de una comunidad' })
  async findBySlug(
    @Param('slug') slug: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.communitiesService.findBySlug(slug, viewer?.sub ?? null);
  }

  @Public()
  @Get('communities/:slug/members')
  @ApiOperation({ summary: 'Listado de miembros de la comunidad' })
  getMembers(
    @Param('slug') slug: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number(limit) : 20;
    return this.membersService.getMembers(
      slug,
      cursor,
      Number.isFinite(parsed) ? parsed : 20,
    );
  }

  // ── Authenticated CRUD ──

  @ApiBearerAuth()
  @Post('communities')
  @ApiOperation({ summary: 'Crear una nueva comunidad' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCommunityDto,
  ) {
    return this.communitiesService.create(dto, user.sub);
  }

  @ApiBearerAuth()
  @Patch('communities/:slug')
  @ApiOperation({ summary: 'Editar comunidad propia' })
  update(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateCommunityDto,
  ) {
    return this.communitiesService.update(slug, dto, user.sub);
  }

  @ApiBearerAuth()
  @Delete('communities/:slug')
  @ApiOperation({ summary: 'Eliminar comunidad propia' })
  delete(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
    @Query('force') force?: string,
  ) {
    return this.communitiesService.delete(slug, user.sub, force === 'true');
  }

  // ── Membership ──

  @ApiBearerAuth()
  @Post('communities/:slug/join')
  @ApiOperation({ summary: 'Unirse a una comunidad' })
  join(@Param('slug') slug: string, @CurrentUser() user: JwtPayload) {
    return this.membersService.join(slug, user.sub);
  }

  @ApiBearerAuth()
  @Delete('communities/:slug/leave')
  @ApiOperation({ summary: 'Abandonar una comunidad' })
  leave(@Param('slug') slug: string, @CurrentUser() user: JwtPayload) {
    return this.membersService.leave(slug, user.sub);
  }

  @ApiBearerAuth()
  @Post('communities/:slug/follow')
  @ApiOperation({ summary: 'Seguir una comunidad' })
  follow(@Param('slug') slug: string, @CurrentUser() user: JwtPayload) {
    return this.membersService.follow(slug, user.sub);
  }

  @ApiBearerAuth()
  @Delete('communities/:slug/follow')
  @ApiOperation({ summary: 'Dejar de seguir una comunidad' })
  unfollow(@Param('slug') slug: string, @CurrentUser() user: JwtPayload) {
    return this.membersService.unfollow(slug, user.sub);
  }

  // ── My communities ──

  @ApiBearerAuth()
  @Get('me/communities')
  @ApiOperation({ summary: 'Comunidades en las que soy miembro' })
  getMyMemberships(@CurrentUser() user: JwtPayload) {
    return this.membersService.getMyMemberships(user.sub);
  }

  @ApiBearerAuth()
  @Get('me/communities/following')
  @ApiOperation({ summary: 'Comunidades que sigo' })
  getMyFollowed(@CurrentUser() user: JwtPayload) {
    return this.membersService.getMyFollowed(user.sub);
  }

  @Public()
  @Post('communities/:slug/comments')
  @ApiOperation({ summary: 'Bloqueado: comunidades no admiten comentarios' })
  communityComments() {
    throw new GoneException(
      'Las comunidades no admiten comentarios directos. Usa los foros de la comunidad.',
    );
  }

  @ApiBearerAuth()
  @Post('communities/:slug/related-novels')
  @ApiOperation({ summary: 'Vincular una novela propia como obra relacionada' })
  addRelatedNovel(
    @Param('slug') slug: string,
    @Body() body: { novelId: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.communitiesService.addRelatedNovel(slug, body.novelId, user.sub);
  }

  @ApiBearerAuth()
  @Delete('communities/:slug/related-novels/:novelId')
  @ApiOperation({ summary: 'Desvincular una obra relacionada' })
  removeRelatedNovel(
    @Param('slug') slug: string,
    @Param('novelId') novelId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.communitiesService.removeRelatedNovel(slug, novelId, user.sub);
  }

  @ApiBearerAuth()
  @Get('me/communities/owned')
  @ApiOperation({ summary: 'Comunidades de las que soy creador' })
  getMyOwned(@CurrentUser() user: JwtPayload) {
    return this.communitiesService.findMyOwned(user.sub);
  }
}
