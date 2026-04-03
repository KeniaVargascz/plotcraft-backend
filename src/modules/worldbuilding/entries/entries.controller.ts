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
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';
import { AuthService } from '../../auth/auth.service';
import { EntriesService } from './entries.service';
import { CreateEntryDto } from './dto/create-entry.dto';
import { CreateLinkDto } from './dto/create-link.dto';
import { EntryQueryDto } from './dto/entry-query.dto';
import { ReorderEntriesDto } from './dto/reorder-entries.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';

@ApiTags('worldbuilding-entries')
@Controller('worlds/:slug/wb')
export class EntriesController {
  constructor(
    private readonly entriesService: EntriesService,
    private readonly authService: AuthService,
  ) {}

  @Public()
  @Get('entries')
  @ApiOperation({ summary: 'Listar entradas de un mundo' })
  listEntries(
    @Param('slug') slug: string,
    @Query() query: EntryQueryDto,
  ) {
    return this.entriesService.listEntries(slug, query);
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Busqueda full-text de entradas en un mundo' })
  search(
    @Param('slug') slug: string,
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    return this.entriesService.searchEntries(
      slug,
      q,
      limit ? Math.min(Math.max(Number(limit), 1), 50) : 20,
    );
  }

  @Public()
  @Get('entries/:entrySlug')
  @ApiOperation({ summary: 'Detalle de una entrada' })
  async getEntry(
    @Param('slug') slug: string,
    @Param('entrySlug') entrySlug: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.entriesService.getEntry(slug, entrySlug, viewer?.sub ?? null);
  }

  @Public()
  @Get('categories/:catSlug/entries')
  @ApiOperation({ summary: 'Listar entradas por categoria' })
  listEntriesByCategory(
    @Param('slug') slug: string,
    @Param('catSlug') catSlug: string,
    @Query() query: EntryQueryDto,
  ) {
    return this.entriesService.listEntriesByCategory(slug, catSlug, query);
  }

  @ApiBearerAuth()
  @Post('entries')
  @ApiOperation({ summary: 'Crear entrada' })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Body() dto: CreateEntryDto,
  ) {
    return this.entriesService.create(user.sub, slug, dto);
  }

  @ApiBearerAuth()
  @Patch('entries/:entrySlug')
  @ApiOperation({ summary: 'Actualizar entrada' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Param('entrySlug') entrySlug: string,
    @Body() dto: UpdateEntryDto,
  ) {
    return this.entriesService.update(user.sub, slug, entrySlug, dto);
  }

  @ApiBearerAuth()
  @Delete('entries/:entrySlug')
  @ApiOperation({ summary: 'Eliminar entrada' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Param('entrySlug') entrySlug: string,
  ) {
    return this.entriesService.remove(user.sub, slug, entrySlug);
  }

  @ApiBearerAuth()
  @Patch('categories/:catSlug/entries/reorder')
  @ApiOperation({ summary: 'Reordenar entradas dentro de una categoria' })
  reorder(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Param('catSlug') catSlug: string,
    @Body() dto: ReorderEntriesDto,
  ) {
    return this.entriesService.reorderEntries(
      user.sub,
      slug,
      catSlug,
      dto.entries.map((e) => ({ id: e.id, order: e.order })),
    );
  }

  @ApiBearerAuth()
  @Post('entries/:entrySlug/links')
  @ApiOperation({ summary: 'Crear vinculo entre entradas' })
  createLink(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Param('entrySlug') entrySlug: string,
    @Body() dto: CreateLinkDto,
  ) {
    return this.entriesService.createLink(user.sub, slug, entrySlug, dto);
  }

  @ApiBearerAuth()
  @Delete('entries/:entrySlug/links/:linkId')
  @ApiOperation({ summary: 'Eliminar vinculo' })
  deleteLink(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Param('entrySlug') entrySlug: string,
    @Param('linkId') linkId: string,
  ) {
    return this.entriesService.deleteLink(user.sub, slug, entrySlug, linkId);
  }

  @Public()
  @Get('entries/:entrySlug/links')
  @ApiOperation({ summary: 'Listar vinculos de una entrada' })
  listLinks(
    @Param('slug') slug: string,
    @Param('entrySlug') entrySlug: string,
  ) {
    return this.entriesService.listLinks(slug, entrySlug);
  }
}
