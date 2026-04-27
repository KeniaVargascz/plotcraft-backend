import { Controller, Delete, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { FeatureFlag } from '../../config/feature-flags.constants';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { KudosService } from './kudos.service';

@ApiTags('kudos')
@ApiBearerAuth()
@RequireFeature(FeatureFlag.READER_KUDOS)
@Controller('kudos')
export class KudosController {
  constructor(private readonly kudosService: KudosService) {}

  @Post('characters/:characterId')
  @ApiOperation({ summary: 'Dar kudo a un personaje' })
  addCharacterKudo(
    @CurrentUser() user: JwtPayload,
    @Param('characterId') characterId: string,
  ) {
    return this.kudosService.addCharacterKudo(characterId, user.sub);
  }

  @Delete('characters/:characterId')
  @ApiOperation({ summary: 'Quitar kudo de un personaje' })
  removeCharacterKudo(
    @CurrentUser() user: JwtPayload,
    @Param('characterId') characterId: string,
  ) {
    return this.kudosService.removeCharacterKudo(characterId, user.sub);
  }

  @Post('worlds/:worldId')
  @ApiOperation({ summary: 'Dar kudo a un mundo' })
  addWorldKudo(
    @CurrentUser() user: JwtPayload,
    @Param('worldId') worldId: string,
  ) {
    return this.kudosService.addWorldKudo(worldId, user.sub);
  }

  @Delete('worlds/:worldId')
  @ApiOperation({ summary: 'Quitar kudo de un mundo' })
  removeWorldKudo(
    @CurrentUser() user: JwtPayload,
    @Param('worldId') worldId: string,
  ) {
    return this.kudosService.removeWorldKudo(worldId, user.sub);
  }
}
