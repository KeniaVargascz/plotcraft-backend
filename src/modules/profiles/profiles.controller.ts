import { Body, Controller, Get, Headers, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from '../auth/auth.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfilesService } from './profiles.service';

@ApiTags('profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly authService: AuthService,
  ) {}

  @Public()
  @Get(':username')
  @ApiOperation({ summary: 'Ver perfil publico por username' })
  async getPublicProfile(
    @Param('username') username: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.profilesService.getPublicProfile(username, viewer?.sub ?? null);
  }

  @ApiBearerAuth()
  @Patch('me')
  @ApiOperation({ summary: 'Editar perfil autenticado' })
  updateMyProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profilesService.updateMyProfile(user.sub, dto);
  }
}
