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
  @ApiOperation({ summary: 'Admin login — returns tfaToken + phoneRequired flag' })
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.login(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('register-phone')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register phone for OTP delivery (if not already set)' })
  registerPhone(@Body() body: { tfaToken: string; phone: string }) {
    return this.adminAuthService.registerPhone(body.tfaToken, body.phone);
  }

  @Public()
  @HttpCode(200)
  @Post('send-otp')
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Send login OTP via SMS, WhatsApp, or email' })
  sendLoginOtp(@Body() body: { tfaToken: string; channel?: 'sms' | 'whatsapp' | 'email' }) {
    return this.adminAuthService.sendLoginOtp(body.tfaToken, body.channel);
  }

  @Public()
  @HttpCode(200)
  @Post('verify-otp')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify login OTP and complete admin login' })
  verifyLoginOtp(@Body() body: { tfaToken: string; code: string }) {
    return this.adminAuthService.verifyLoginOtp(body.tfaToken, body.code);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get authenticated admin profile' })
  me(@CurrentUser() user: JwtPayload) {
    return this.adminAuthService.getAdminProfile(user.sub);
  }

  // 2FA setup endpoints (require auth) — kept for settings panel
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
