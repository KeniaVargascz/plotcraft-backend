import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CacheTtl } from '../../common/decorators/cache-ttl.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { DiscoveryResponseDto } from './dto/discovery-response.dto';
import { FeaturedResponseDto } from './dto/featured-response.dto';
import { TrendingResponseDto } from './dto/trending-response.dto';
import { DiscoveryService } from './discovery.service';

@ApiTags('discovery')
@Controller('discovery')
@Public()
@CacheTtl(300)
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get()
  @ApiOperation({ summary: 'Snapshot completo de discovery' })
  @ApiOkResponse({ type: DiscoveryResponseDto })
  getSnapshot(@Query('refresh') refresh?: string) {
    return this.discoveryService.getSnapshot(refresh === '1');
  }

  @Get('trending/novels')
  @ApiOperation({ summary: 'Novelas en tendencia' })
  @ApiOkResponse({ type: TrendingResponseDto })
  getTrendingNovels(@Query('refresh') refresh?: string) {
    return this.discoveryService.getTrendingNovels(refresh === '1');
  }

  @Get('trending/worlds')
  @ApiOperation({ summary: 'Mundos en tendencia' })
  @ApiOkResponse({ type: TrendingResponseDto })
  getTrendingWorlds(@Query('refresh') refresh?: string) {
    return this.discoveryService.getTrendingWorlds(refresh === '1');
  }

  @Get('trending/characters')
  @ApiOperation({ summary: 'Personajes en tendencia' })
  @ApiOkResponse({ type: TrendingResponseDto })
  getTrendingCharacters(@Query('refresh') refresh?: string) {
    return this.discoveryService.getTrendingCharacters(refresh === '1');
  }

  @Get('trending/authors')
  @ApiOperation({ summary: 'Autores en tendencia' })
  @ApiOkResponse({ type: TrendingResponseDto })
  getTrendingAuthors(@Query('refresh') refresh?: string) {
    return this.discoveryService.getTrendingAuthors(refresh === '1');
  }

  @Get('featured')
  @ApiOperation({ summary: 'Contenido destacado' })
  @ApiOkResponse({ type: FeaturedResponseDto })
  getFeatured(@Query('refresh') refresh?: string) {
    return this.discoveryService.getFeatured(refresh === '1');
  }

  @Get('new-releases')
  @ApiOperation({ summary: 'Nuevos lanzamientos por novela' })
  getNewReleases(@Query('refresh') refresh?: string) {
    return this.discoveryService.getNewReleases(refresh === '1');
  }

  @Get('genres/:slug')
  @ApiOperation({ summary: 'Discovery por genero' })
  getGenre(@Param('slug') slug: string) {
    return this.discoveryService.getGenreDiscovery(slug);
  }
}
