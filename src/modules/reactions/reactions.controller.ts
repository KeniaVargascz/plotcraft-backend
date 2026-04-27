import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { FeatureFlag } from '../../config/feature-flags.constants';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ToggleReactionDto } from './dto/toggle-reaction.dto';
import { ReactionsService } from './reactions.service';

@ApiTags('reactions')
@RequireFeature(FeatureFlag.SOCIAL_FEED)
@Controller('posts/:postId/reactions')
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Toggle de reaccion en post' })
  toggleReaction(
    @Param('postId') postId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ToggleReactionDto,
  ) {
    return this.reactionsService.toggleReaction(postId, user.sub, dto);
  }
}
