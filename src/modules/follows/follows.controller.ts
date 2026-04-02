import {
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from '../auth/auth.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { FeedQueryDto } from '../feed/dto/feed-query.dto';
import { FollowsService } from './follows.service';

@ApiTags('follows')
@Controller('follows')
export class FollowsController {
  constructor(
    private readonly followsService: FollowsService,
    private readonly authService: AuthService,
  ) {}

  @ApiBearerAuth()
  @Post(':username')
  @ApiOperation({ summary: 'Seguir a un usuario' })
  followUser(
    @CurrentUser() user: JwtPayload,
    @Param('username') username: string,
  ) {
    return this.followsService.followUser(user.sub, username);
  }

  @ApiBearerAuth()
  @Delete(':username')
  @ApiOperation({ summary: 'Dejar de seguir a un usuario' })
  unfollowUser(
    @CurrentUser() user: JwtPayload,
    @Param('username') username: string,
  ) {
    return this.followsService.unfollowUser(user.sub, username);
  }

  @Public()
  @Get(':username/followers')
  @ApiOperation({ summary: 'Listar seguidores de un usuario' })
  async getFollowers(
    @Param('username') username: string,
    @Query() query: FeedQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.followsService.listFollowers({
      username,
      cursor: query.cursor,
      limit: query.limit,
      viewerId: viewer?.sub ?? null,
      mode: 'followers',
    });
  }

  @Public()
  @Get(':username/following')
  @ApiOperation({ summary: 'Listar seguidos de un usuario' })
  async getFollowing(
    @Param('username') username: string,
    @Query() query: FeedQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.followsService.listFollowing({
      username,
      cursor: query.cursor,
      limit: query.limit,
      viewerId: viewer?.sub ?? null,
      mode: 'following',
    });
  }

  @ApiBearerAuth()
  @Get('me/suggestions')
  @ApiOperation({ summary: 'Sugerencias de usuarios para seguir' })
  getSuggestions(@CurrentUser() user: JwtPayload) {
    return this.followsService.getSuggestions(user.sub);
  }
}
