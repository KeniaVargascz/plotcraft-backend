import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminAuthService } from '../services/admin-auth.service';
import { AdminTfaService } from '../services/admin-tfa.service';
import { AdminPasswordService } from '../services/admin-password.service';
import { AdminLoginDto } from '../dto/admin-login.dto';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

@ApiTags('admin/auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly tfaService: AdminTfaService,
    private readonly passwordService: AdminPasswordService,
  ) {}

  @Public()
  @HttpCode(200)
  @Post('login')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Admin login (returns tfaRequired if 2FA enabled)' })
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.login(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('tfa/verify')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify 2FA code and complete admin login' })
  verifyTfa(@Body() body: { tfaToken: string; code: string }) {
    return this.adminAuthService.verifyTfa(body.tfaToken, body.code);
  }

  @Public()
  @HttpCode(200)
  @Post('tfa/setup-and-enable')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Enable 2FA + register phone during mandatory setup' })
  setupAndEnable(@Body() body: { tfaToken: string; code: string; phone: string }) {
    return this.adminAuthService.setupAndEnable(body.tfaToken, body.code, body.phone);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get authenticated admin profile' })
  me(@CurrentUser() user: JwtPayload) {
    return this.adminAuthService.getAdminProfile(user.sub);
  }

  // 2FA setup endpoints (require auth)
  @Post('tfa/setup')
  @ApiOperation({ summary: 'Generate 2FA QR code and secret' })
  tfaSetup(@CurrentUser() user: JwtPayload) {
    return this.tfaService.generateSetup(user.sub);
  }

  @HttpCode(200)
  @Post('tfa/enable')
  @ApiOperation({ summary: 'Enable 2FA with verification code' })
  tfaEnable(@CurrentUser() user: JwtPayload, @Body() body: { code: string }) {
    return this.tfaService.enableTfa(user.sub, body.code);
  }

  @HttpCode(200)
  @Post('tfa/disable')
  @ApiOperation({ summary: 'Disable 2FA with verification code' })
  tfaDisable(@CurrentUser() user: JwtPayload, @Body() body: { code: string }) {
    return this.tfaService.disableTfa(user.sub, body.code);
  }

  // Password management
  @HttpCode(200)
  @Post('change-password')
  @ApiOperation({ summary: 'Change admin password (requires current + 2FA)' })
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() body: { currentPassword: string; newPassword: string; tfaCode: string },
  ) {
    return this.passwordService.changePassword(user, body);
  }

  @Public()
  @HttpCode(200)
  @Post('forgot-password')
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Send admin password reset OTP via SMS/WhatsApp' })
  forgotPassword(@Body() body: { email: string; channel?: 'sms' | 'whatsapp' }) {
    return this.passwordService.forgotPassword(body);
  }

  @Public()
  @HttpCode(200)
  @Post('reset-password')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Reset admin password with OTP code' })
  resetPassword(@Body() body: { email: string; code: string; newPassword: string }) {
    return this.passwordService.resetPassword(body);
  }

  @HttpCode(200)
  @Post('update-phone')
  @ApiOperation({ summary: 'Update admin phone number for OTP delivery' })
  updatePhone(
    @CurrentUser() user: JwtPayload,
    @Body() body: { phone: string; tfaCode: string },
  ) {
    return this.passwordService.updatePhone(user, body);
  }
}
