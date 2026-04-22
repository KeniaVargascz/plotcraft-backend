import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterInitiateDto } from './dto/register-initiate.dto';
import { RegisterVerifyDto } from './dto/register-verify.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { AuthService } from './auth.service';
import type { JwtPayload } from './strategies/jwt.strategy';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(201)
  @Post('register/initiate')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Iniciar registro con verificacion OTP' })
  registerInitiate(@Body() dto: RegisterInitiateDto) {
    return this.authService.registerInitiate(dto).then(() => ({
      message: 'Codigo de verificacion enviado',
    }));
  }

  @Public()
  @HttpCode(200)
  @Post('register/verify')
  @ApiOperation({ summary: 'Verificar codigo OTP de registro' })
  registerVerify(@Body() dto: RegisterVerifyDto) {
    return this.authService.registerVerify(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('register/resend')
  @ApiOperation({ summary: 'Reenviar codigo OTP' })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto).then(() => ({
      message: 'Codigo reenviado',
    }));
  }

  @Public()
  @HttpCode(200)
  @Post('forgot-password')
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Solicitar codigo de recuperacion de contraseña' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto).then(() => ({
      message: 'Si el correo existe, se envio un codigo de recuperacion',
    }));
  }

  @Public()
  @HttpCode(200)
  @Post('reset-password')
  @ApiOperation({ summary: 'Restablecer contraseña con codigo OTP' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto).then(() => ({
      message: 'Contraseña actualizada correctamente',
    }));
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Login de usuario' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Rotar refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @ApiBearerAuth()
  @HttpCode(200)
  @Post('logout')
  @ApiOperation({ summary: 'Revocar refresh token actual' })
  logout(@CurrentUser() user: JwtPayload, @Body() dto: RefreshTokenDto) {
    return this.authService.logout(user, dto);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Obtener usuario autenticado' })
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub);
  }
}
