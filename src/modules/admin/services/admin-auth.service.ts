import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthService } from '../../auth/auth.service';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { AdminAuditService } from './admin-audit.service';
import { OtpService } from '../../otp/otp.service';
import { SmsService } from '../../sms/sms.service';
import { Role, hasRole } from '../../../common/constants/roles';

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly auditService: AdminAuditService,
    private readonly otpService: OtpService,
    private readonly smsService: SmsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Step 1: Email/password login.
   * Returns a temporary token + whether the user needs to register a phone.
   */
  async login(dto: AdminLoginDto) {
    const result = await this.authService.login({
      identifier: dto.email,
      password: dto.password,
    });

    const user = await this.prisma.user.findUnique({
      where: { id: result.user.id },
      select: { isAdmin: true, role: true, phone: true },
    });

    if (!user || !hasRole(user.role, Role.MASTER)) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Access restricted to administrators.',
        code: 'NOT_ADMIN',
      });
    }

    const tfaToken = await this.jwtService.signAsync(
      { sub: result.user.id, email: result.user.email, purpose: 'tfa' },
      {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: '10m',
      },
    );

    if (user.phone) {
      // Has phone — ready to receive OTP
      return { phoneRequired: false, tfaToken };
    }

    // No phone — frontend must collect it first
    return { phoneRequired: true, tfaToken };
  }

  /**
   * Step 2 (optional): Register phone number for a user who doesn't have one.
   * SECURITY: Only allowed if user has NO phone. Cannot overwrite existing phone.
   */
  async registerPhone(tfaToken: string, phone: string) {
    const payload = await this.verifyTfaToken(tfaToken);

    this.validatePhone(phone);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
      select: { phone: true },
    });

    if (user.phone) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Phone number already registered. Use settings to change it.',
        code: 'PHONE_ALREADY_REGISTERED',
      });
    }

    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { phone },
    });

    await this.auditService.log({
      adminId: payload.sub,
      adminEmail: payload.email,
      action: 'ADMIN_PHONE_REGISTERED',
      resourceType: 'auth',
      details: { phone },
    });

    return { registered: true };
  }

  /**
   * Step 3: Send OTP to the admin's phone via SMS or WhatsApp.
   */
  async sendLoginOtp(tfaToken: string, channel: 'sms' | 'whatsapp' = 'sms') {
    const payload = await this.verifyTfaToken(tfaToken);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
      select: { phone: true },
    });

    if (!user.phone) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Phone number not registered',
        code: 'PHONE_NOT_REGISTERED',
      });
    }

    const plainCode = await this.otpService.create(payload.sub, 'ADMIN_LOGIN');

    this.smsService.sendOtp(user.phone, plainCode, channel).then((result) => {
      if (!result.success) {
        this.logger.warn(`Admin login OTP ${channel} failed for ${payload.sub}: ${result.error}`);
      }
    }).catch((err) => {
      this.logger.error(`Admin login OTP ${channel} error for ${payload.sub}: ${err}`);
    });

    return { sent: true, channel };
  }

  /**
   * Step 4: Verify the OTP code and complete login.
   */
  async verifyLoginOtp(tfaToken: string, code: string) {
    const payload = await this.verifyTfaToken(tfaToken);

    const result = await this.otpService.verify(payload.sub, code, 'ADMIN_LOGIN');

    if (!result.valid) {
      const reason = (result as { reason: string }).reason;
      if (reason === 'expired') {
        throw new BadRequestException({
          statusCode: 400,
          message: 'El codigo ha expirado. Solicita uno nuevo.',
          code: 'OTP_EXPIRED',
        });
      }
      if (reason === 'too_many_attempts') {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Demasiados intentos. Espera unos minutos.',
          code: 'TOO_MANY_ATTEMPTS',
        });
      }
      throw new BadRequestException({
        statusCode: 400,
        message: 'Codigo invalido',
        code: 'OTP_INVALID',
      });
    }

    const session = await this.createSessionForUser(payload.sub);

    await this.auditService.log({
      adminId: payload.sub,
      adminEmail: payload.email,
      action: 'LOGIN_OTP',
      resourceType: 'auth',
    });

    return session;
  }

  // --- Helper methods ---

  private async verifyTfaToken(tfaToken: string): Promise<{ sub: string; email: string; purpose: string }> {
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; email: string; purpose: string }>(tfaToken, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });

      if (payload.purpose !== 'tfa') {
        throw new Error('wrong purpose');
      }

      return payload;
    } catch {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'La sesion expiro. Inicia sesion de nuevo.',
        code: 'TFA_TOKEN_INVALID',
      });
    }
  }

  private validatePhone(phone: string) {
    const phoneRegex = /^\+[1-9]\d{7,14}$/;
    if (!phone || !phoneRegex.test(phone)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Numero de telefono invalido. Formato E.164 requerido (ej. +521234567890)',
        code: 'INVALID_PHONE',
      });
    }
  }

  private async createSessionForUser(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    });

    const tokenPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isAdmin: user.isAdmin,
      jti: crypto.randomUUID(),
    };

    const accessToken = await this.jwtService.signAsync(tokenPayload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m') as never,
    });

    const refreshToken = await this.jwtService.signAsync(tokenPayload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as never,
    });

    const { createHash } = await import('crypto');
    const bcrypt = await import('bcrypt');
    const tokenDigest = createHash('sha256').update(refreshToken).digest('hex');
    const tokenHash = await bcrypt.hash(tokenDigest, 10);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: user.id,
        family: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
        profile: user.profile,
      },
      accessToken,
      refreshToken,
    };
  }

  async getAdminProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        isAdmin: true,
        role: true,
        tfaEnabled: true,
        phone: true,
        createdAt: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!hasRole(user.role, Role.MASTER)) {
      throw new UnauthorizedException({ statusCode: 401, message: 'Access restricted to administrators.', code: 'NOT_ADMIN' });
    }

    return user;
  }
}
