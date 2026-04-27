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
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { FeatureFlag } from '../../config/feature-flags.constants';
import { AuthService } from '../auth/auth.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AddNovelToSeriesDto } from './dto/add-novel-to-series.dto';
import { CreateSeriesDto } from './dto/create-series.dto';
import { ReorderNovelsDto } from './dto/reorder-novels.dto';
import { SeriesQueryDto } from './dto/series-query.dto';
import { UpdateSeriesDto } from './dto/update-series.dto';
import { UpdateSeriesStatusDto } from './dto/update-series-status.dto';
import { SeriesService } from './series.service';

@ApiTags('series')
@RequireFeature(FeatureFlag.EXPLORE_SERIES_CATALOG)
@Controller('series')
export class SeriesController {
  constructor(
    private readonly seriesService: SeriesService,
    private readonly authService: AuthService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Listado publico de series' })
  async list(
    @Query() query: SeriesQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.seriesService.listSeries(query, viewer?.sub ?? null);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Detalle de una serie' })
  async getBySlug(
    @Param('slug') slug: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.seriesService.getSeriesBySlug(slug, viewer?.sub ?? null);
  }

  @Public()
  @Get(':slug/novels')
  @ApiOperation({ summary: 'Novelas de una serie' })
  async listNovels(
    @Param('slug') slug: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    const series = await this.seriesService.getSeriesBySlug(
      slug,
      viewer?.sub ?? null,
    );
    return { data: series.novels };
  }

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Crear serie' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateSeriesDto) {
    return this.seriesService.createSeries(user.sub, dto);
  }

  @ApiBearerAuth()
  @Patch(':slug')
  @ApiOperation({ summary: 'Editar serie propia' })
  update(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateSeriesDto,
  ) {
    return this.seriesService.updateSeries(slug, user.sub, dto);
  }

  @ApiBearerAuth()
  @Delete(':slug')
  @ApiOperation({ summary: 'Eliminar serie propia' })
  delete(@Param('slug') slug: string, @CurrentUser() user: JwtPayload) {
    return this.seriesService.deleteSeries(slug, user.sub);
  }

  @ApiBearerAuth()
  @Post(':slug/novels')
  @ApiOperation({ summary: 'Anadir novela a la serie' })
  addNovel(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: AddNovelToSeriesDto,
  ) {
    return this.seriesService.addNovelToSeries(slug, user.sub, dto);
  }

  @ApiBearerAuth()
  @Delete(':slug/novels/:novelId')
  @ApiOperation({ summary: 'Quitar novela de la serie' })
  removeNovel(
    @Param('slug') slug: string,
    @Param('novelId') novelId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.seriesService.removeNovelFromSeries(slug, user.sub, novelId);
  }

  @ApiBearerAuth()
  @Patch(':slug/novels/reorder')
  @ApiOperation({ summary: 'Reordenar novelas de la serie' })
  reorder(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReorderNovelsDto,
  ) {
    return this.seriesService.reorderNovels(slug, user.sub, dto);
  }

  @ApiBearerAuth()
  @Patch(':slug/status')
  @ApiOperation({ summary: 'Cambiar estado de la serie' })
  updateStatus(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateSeriesStatusDto,
  ) {
    return this.seriesService.updateSeriesStatus(slug, user.sub, dto);
  }
}
