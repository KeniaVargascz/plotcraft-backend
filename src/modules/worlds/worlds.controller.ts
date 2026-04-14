import {
  Body,
  Controller,
  Delete,
  Get,
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
import { CreateLocationDto } from './dto/create-location.dto';
import { CreateWorldDto } from './dto/create-world.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateWorldDto } from './dto/update-world.dto';
import { WorldQueryDto } from './dto/world-query.dto';
import { WorldsService } from './worlds.service';

@ApiTags('worlds')
@Controller('worlds')
export class WorldsController {
  constructor(
    private readonly worldsService: WorldsService,
    private readonly authService: AuthService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Catalogo publico de mundos' })
  async listPublic(
    @Query() query: WorldQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.worldsService.listPublic(query, viewer?.sub ?? null);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Mis mundos' })
  listMine(@CurrentUser() user: JwtPayload, @Query() query: WorldQueryDto) {
    return this.worldsService.listMine(user.sub, query);
  }

  @Public()
  @Get('user/:username')
  @ApiOperation({ summary: 'Mundos publicos de un autor' })
  async listByUser(
    @Param('username') username: string,
    @Query() query: WorldQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.worldsService.listByUser(username, query, viewer?.sub ?? null);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Detalle de un mundo' })
  async getBySlug(
    @Param('slug') slug: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.worldsService.getBySlug(slug, viewer?.sub ?? null);
  }

  @Public()
  @Get(':slug/novels')
  @ApiOperation({ summary: 'Novelas vinculadas a un mundo' })
  async listWorldNovels(
    @Param('slug') slug: string,
    @Query() query: WorldQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.worldsService.listLinkedNovels(slug, viewer?.sub ?? null, query);
  }

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Crear mundo' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateWorldDto) {
    return this.worldsService.create(user.sub, dto);
  }

  @ApiBearerAuth()
  @Patch(':slug')
  @ApiOperation({ summary: 'Editar mundo propio' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Body() dto: UpdateWorldDto,
  ) {
    return this.worldsService.update(user.sub, slug, dto);
  }

  @ApiBearerAuth()
  @Delete(':slug')
  @ApiOperation({ summary: 'Eliminar mundo propio' })
  remove(@CurrentUser() user: JwtPayload, @Param('slug') slug: string) {
    return this.worldsService.remove(user.sub, slug);
  }

  @ApiBearerAuth()
  @Post(':slug/locations')
  @ApiOperation({ summary: 'Crear ubicacion en un mundo propio' })
  createLocation(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Body() dto: CreateLocationDto,
  ) {
    return this.worldsService.createLocation(user.sub, slug, dto);
  }

  @ApiBearerAuth()
  @Patch(':slug/locations/:locationId')
  @ApiOperation({ summary: 'Editar ubicacion de un mundo propio' })
  updateLocation(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Param('locationId') locationId: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.worldsService.updateLocation(user.sub, slug, locationId, dto);
  }

  @ApiBearerAuth()
  @Delete(':slug/locations/:locationId')
  @ApiOperation({ summary: 'Eliminar ubicacion de un mundo propio' })
  removeLocation(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Param('locationId') locationId: string,
  ) {
    return this.worldsService.removeLocation(user.sub, slug, locationId);
  }

  @ApiBearerAuth()
  @Post(':slug/novels/:novelSlug')
  @ApiOperation({ summary: 'Vincular novela propia a un mundo propio' })
  linkNovel(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Param('novelSlug') novelSlug: string,
  ) {
    return this.worldsService.linkNovel(user.sub, slug, novelSlug);
  }

  @ApiBearerAuth()
  @Delete(':slug/novels/:novelSlug')
  @ApiOperation({ summary: 'Desvincular novela de un mundo propio' })
  unlinkNovel(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Param('novelSlug') novelSlug: string,
  ) {
    return this.worldsService.unlinkNovel(user.sub, slug, novelSlug);
  }
}
