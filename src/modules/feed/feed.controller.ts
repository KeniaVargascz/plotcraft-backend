import { Controller, Get, Headers, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from '../auth/auth.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { FeedQueryDto } from './dto/feed-query.dto';
import { FeedService } from './feed.service';

@ApiTags('feed')
@Controller('feed')
export class FeedController {
  constructor(
    private readonly feedService: FeedService,
    private readonly authService: AuthService,
  ) {}

  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'Feed personalizado del usuario autenticado' })
  getFeed(@CurrentUser() user: JwtPayload, @Query() query: FeedQueryDto) {
    return this.feedService.getPersonalizedFeed(user.sub, query);
  }

  @ApiBearerAuth()
  @Get('search')
  @ApiOperation({ summary: 'Buscar en el feed de seguidos' })
  searchFeed(@CurrentUser() user: JwtPayload, @Query() query: FeedQueryDto) {
    return this.feedService.searchFeed(user.sub, query);
  }

  @Public()
  @Get('explore')
  @ApiOperation({ summary: 'Feed publico de exploracion' })
  async getExploreFeed(
    @Query() query: FeedQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.feedService.getExploreFeed(query, viewer?.sub ?? null);
  }

  @Public()
  @Get('explore/search')
  @ApiOperation({ summary: 'Buscar en el feed publico de exploracion' })
  async searchExplore(
    @Query() query: FeedQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.feedService.searchExplore(query, viewer?.sub ?? null);
  }
}
