import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { FeatureFlag } from '../../config/feature-flags.constants';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { VotesService } from './votes.service';

@ApiTags('votes')
@ApiBearerAuth()
@RequireFeature(FeatureFlag.READER_VOTES)
@Controller('votes')
export class VotesController {
  constructor(private readonly votesService: VotesService) {}

  @Post('chapters/:chapterId')
  @ApiOperation({ summary: 'Votar por un capitulo' })
  castVote(
    @CurrentUser() user: JwtPayload,
    @Param('chapterId') chapterId: string,
  ) {
    return this.votesService.castVote(user.sub, chapterId);
  }

  @Delete('chapters/:chapterId')
  @ApiOperation({ summary: 'Retirar voto de un capitulo' })
  removeVote(
    @CurrentUser() user: JwtPayload,
    @Param('chapterId') chapterId: string,
  ) {
    return this.votesService.removeVote(user.sub, chapterId);
  }

  @Get('chapters/:chapterId/me')
  @ApiOperation({ summary: 'Consultar estado de voto en un capitulo' })
  getVoteStatus(
    @CurrentUser() user: JwtPayload,
    @Param('chapterId') chapterId: string,
  ) {
    return this.votesService.getVoteStatus(user.sub, chapterId);
  }
}
