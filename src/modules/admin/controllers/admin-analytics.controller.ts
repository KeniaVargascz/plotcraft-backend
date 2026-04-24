import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { AdminAnalyticsService } from '../services/admin-analytics.service';

@ApiTags('admin/analytics')
@Controller('admin/analytics')
@UseGuards(AdminGuard)
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AdminAnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Métricas avanzadas con comparativa' })
  getOverview(@Query('days') days?: string) {
    return this.analyticsService.getOverview(Number(days) || 30);
  }

  @Get('top-novels')
  @ApiOperation({ summary: 'Top novelas por views/kudos' })
  getTopNovels(@Query('limit') limit?: string, @Query('sort') sort?: string) {
    return this.analyticsService.getTopNovels(Math.min(Number(limit) || 10, 50), sort || 'viewsCount');
  }

  @Get('top-authors')
  @ApiOperation({ summary: 'Top autores por novelas/followers' })
  getTopAuthors(@Query('limit') limit?: string) {
    return this.analyticsService.getTopAuthors(Math.min(Number(limit) || 10, 50));
  }

  @Get('content-breakdown')
  @ApiOperation({ summary: 'Desglose de contenido por tipo/status' })
  getContentBreakdown() {
    return this.analyticsService.getContentBreakdown();
  }
}
