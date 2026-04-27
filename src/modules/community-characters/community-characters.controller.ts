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
import { CommunityCharacterStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FeatureFlag } from '../../config/feature-flags.constants';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from '../auth/auth.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CommunityCharactersService } from './community-characters.service';
import { CreateCommunityCharacterDto } from './dto/create-community-character.dto';
import { ReviewSuggestionDto } from './dto/review-suggestion.dto';
import { UpdateCommunityCharacterDto } from './dto/update-community-character.dto';

@ApiTags('community-characters')
@RequireFeature(FeatureFlag.COMMUNITY_COMMUNITIES)
@Controller('communities/:slug/characters')
export class CommunityCharactersController {
  constructor(
    private readonly service: CommunityCharactersService,
    private readonly authService: AuthService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Listar personajes del catálogo de un fandom' })
  async list(
    @Param('slug') slug: string,
    @Query('status') status?: CommunityCharacterStatus,
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    const parsed = limit ? Number(limit) : 30;
    return this.service.list(slug, viewer ? { id: viewer.sub } : null, {
      status,
      search,
      cursor,
      limit: Number.isFinite(parsed) ? parsed : 30,
    });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un personaje del catálogo' })
  async getOne(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.service.getOne(slug, id, viewer ? { id: viewer.sub } : null);
  }

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Crear o sugerir un personaje en un fandom' })
  create(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCommunityCharacterDto,
  ) {
    return this.service.create(slug, user.sub, dto);
  }

  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Editar un personaje del catálogo' })
  update(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateCommunityCharacterDto,
  ) {
    return this.service.update(slug, id, user.sub, dto);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar un personaje del catálogo' })
  remove(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.remove(slug, id, user.sub);
  }

  @ApiBearerAuth()
  @Post(':id/approve')
  @ApiOperation({ summary: 'Aprobar una sugerencia de personaje' })
  approve(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.approve(slug, id, user.sub);
  }

  @ApiBearerAuth()
  @Post(':id/reject')
  @ApiOperation({ summary: 'Rechazar una sugerencia de personaje' })
  reject(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReviewSuggestionDto,
  ) {
    return this.service.reject(slug, id, user.sub, dto);
  }
}
