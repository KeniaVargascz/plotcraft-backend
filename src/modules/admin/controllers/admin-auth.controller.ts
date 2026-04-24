import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminAuthService } from '../services/admin-auth.service';
import { AdminLoginDto } from '../dto/admin-login.dto';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

@ApiTags('admin/auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Public()
  @HttpCode(200)
  @Post('login')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Login de administrador' })
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.login(dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Datos del admin autenticado' })
  me(@CurrentUser() user: JwtPayload) {
    return this.adminAuthService.getAdminProfile(user.sub);
  }
}
