import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { FeatureFlag } from '../../config/feature-flags.constants';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@RequireFeature(FeatureFlag.AUTHOR_ANALYTICS)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /* ── Author (must come before :slug routes) ── */

  @Get('me')
  @ApiOperation({ summary: 'Author analytics overview' })
  getAuthorAnalytics(
    @CurrentUser() user: JwtPayload,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getAuthorAnalytics(
      user.sub,
      query.period ?? '30d',
    );
  }

  @Get('me/timeline')
  @ApiOperation({ summary: 'Author daily snapshots timeline' })
  getAuthorTimeline(
    @CurrentUser() user: JwtPayload,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getAuthorTimeline(
      user.sub,
      query.period ?? '30d',
    );
  }

  @Get('me/audience')
  @ApiOperation({ summary: 'Author audience insights' })
  getAudience(@CurrentUser() user: JwtPayload) {
    return this.analyticsService.getAudience(user.sub);
  }

  /* ── Novel ── */

  @Get('novels/:slug')
  @ApiOperation({ summary: 'Novel analytics overview' })
  getNovelAnalytics(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getNovelAnalytics(
      slug,
      user.sub,
      query.period ?? '30d',
    );
  }

  @Get('novels/:slug/timeline')
  @ApiOperation({ summary: 'Novel daily snapshots timeline' })
  getNovelTimeline(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getNovelTimeline(
      slug,
      user.sub,
      query.period ?? '30d',
    );
  }
}
