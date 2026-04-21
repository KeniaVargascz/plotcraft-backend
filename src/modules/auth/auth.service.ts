import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { USERS_SERVICE, IUsersService } from '../users/users.interface';
import { OtpService } from '../otp/otp.service';
import { EmailService } from '../email/email.service';
import { OTP_EXPIRY_MINUTES, OTP_RESEND_COOLDOWN } from '../otp/otp.constants';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterInitiateDto } from './dto/register-initiate.dto';
import { RegisterVerifyDto } from './dto/register-verify.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { JwtPayload } from './strategies/jwt.strategy';
import { APP_CONFIG } from '../../config/constants';

type SessionUser = Prisma.UserGetPayload<{ include: { profile: true } }>;

@Injectable()
export class AuthService {
  private readonly saltRounds = APP_CONFIG.auth.saltRounds;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(USERS_SERVICE)
    private readonly usersService: IUsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
  ) {}

  async login(dto: LoginDto) {
    const value = dto.identifier.trim();
    const isEmail = value.includes('@');

    const user = isEmail
      ? await this.prisma.user.findUnique({
          where: { email: value.toLowerCase() },
          include: { profile: true },
        })
      : await this.prisma.user.findFirst({
          where: { username: { equals: value, mode: 'insensitive' } },
          include: { profile: true },
        });

    if (!user) {
      // Constant-time: compare against dummy hash to prevent timing attacks
      await bcrypt.compare(dto.password, '$2b$12$invalidhashpaddingtomakeconstanttimeresponse..');
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Credenciales incorrectas',
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_DISABLED',
        message: 'Tu cuenta esta desactivada. Contacta al soporte.',
      });
    }

    // Check account lockout
    if (
      user.failedLoginAttempts >= APP_CONFIG.auth.maxFailedAttempts &&
      user.lockedUntil &&
      user.lockedUntil > new Date()
    ) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_LOCKED',
        message: 'Credenciales incorrectas',
      });
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      const attempts = user.failedLoginAttempts + 1;
      const lockData: { failedLoginAttempts: number; lockedUntil?: Date } = {
        failedLoginAttempts: attempts,
      };
      if (attempts >= APP_CONFIG.auth.maxFailedAttempts) {
        lockData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: lockData,
      });
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Credenciales incorrectas',
      });
    }

    // Reset lockout on successful login
    if (user.failedLoginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    return {
      user: this.usersService.toUserEntity(user),
      ...(await this.createSession(user)),
    };
  }

  async refresh(dto: RefreshTokenDto) {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const user = await this.usersService.findByIdOrFail(payload.sub);

    // Fetch only non-expired tokens for this user (limit to reduce bcrypt calls)
    const activeTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId: user.id,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const matchedToken = await this.findMatchingRefreshToken(
      dto.refreshToken,
      activeTokens,
    );

    if (!matchedToken) {
      // Check if this token matches a revoked one (token reuse = possible theft)
      const revokedTokens = await this.prisma.refreshToken.findMany({
        where: { userId: user.id, revoked: true },
        orderBy: { revokedAt: 'desc' },
        take: 5,
      });
      const reusedToken = await this.findMatchingRefreshToken(
        dto.refreshToken,
        revokedTokens.map((t) => ({ ...t, revoked: false })),
      );
      if (reusedToken) {
        // Token reuse detected — revoke entire family
        await this.prisma.refreshToken.updateMany({
          where: { family: reusedToken.family },
          data: { revoked: true, revokedAt: new Date() },
        });
        this.logger.warn(
          `Token reuse detected for user ${user.id}, family ${reusedToken.family} revoked`,
        );
      }
      throw new UnauthorizedException('Refresh token invalido');
    }

    // Rotate: revoke current token, issue new one in the same family
    await this.prisma.refreshToken.update({
      where: { id: matchedToken.id },
      data: { revoked: true, revokedAt: new Date() },
    });

    return {
      user: this.usersService.toUserEntity(user),
      ...(await this.createSession(user, matchedToken.family)),
    };
  }

  async logout(userId: string, dto: RefreshTokenDto) {
    const activeTokens = await this.prisma.refreshToken.findMany({
      where: { userId, revoked: false, expiresAt: { gt: new Date() } },
      take: 10,
    });

    const matchedToken = await this.findMatchingRefreshToken(
      dto.refreshToken,
      activeTokens,
    );
    if (!matchedToken) {
      throw new UnauthorizedException('Refresh token invalido');
    }

    // Revoke entire family on logout for maximum security
    await this.prisma.refreshToken.updateMany({
      where: { family: matchedToken.family },
      data: { revoked: true, revokedAt: new Date() },
    });

    return { message: 'Sesion cerrada correctamente' };
  }

  async me(userId: string) {
    return this.usersService.getCurrentUser(userId);
  }

  async registerInitiate(dto: RegisterInitiateDto): Promise<void> {
    const [existingUsername, existingEmail] = await Promise.all([
      this.prisma.user.findFirst({
        where: { username: { equals: dto.username, mode: 'insensitive' } },
      }),
      this.prisma.user.findUnique({ where: { email: dto.email } }),
    ]);

    if (existingUsername) {
      throw new ConflictException({
        field: 'username',
        code: 'USERNAME_TAKEN',
        message: 'username already taken',
      });
    }
    if (existingEmail) {
      throw new ConflictException({
        field: 'email',
        code: 'EMAIL_TAKEN',
        message: 'email already taken',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email,
          username: dto.username,
          passwordHash,
          nickname: dto.nickname,
          birthdate: dto.birthdate ? new Date(dto.birthdate) : null,
          status: 'PENDING_VERIFICATION',
          isActive: false,
        },
      });

      await tx.profile.create({
        data: {
          userId: createdUser.id,
          displayName: dto.nickname,
        },
      });

      return createdUser;
    });

    const plainCode = await this.otpService.create(user.id, 'REGISTER_VERIFY');

    const result = await this.emailService.sendOtpVerification({
      to: user.email,
      username: user.username,
      code: plainCode,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });

    if (!result.success) {
      this.logger.warn(
        `Email OTP no enviado para userId=${user.id}: ${result.error}`,
      );
    }
  }

  async registerVerify(dto: RegisterVerifyDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: { profile: true },
    });

    if (!user || user.status !== 'PENDING_VERIFICATION') {
      throw new BadRequestException('Solicitud de verificacion invalida');
    }

    const result = await this.otpService.verify(
      user.id,
      dto.code,
      'REGISTER_VERIFY',
    );

    if (!result.valid) {
      switch (result.reason) {
        case 'expired':
          throw new HttpException({ code: 'OTP_EXPIRED' }, HttpStatus.GONE);
        case 'too_many_attempts':
          throw new HttpException(
            { code: 'TOO_MANY_ATTEMPTS' },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        default:
          throw new BadRequestException({ code: 'OTP_INVALID' });
      }
    }

    const activatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE', isActive: true },
      include: { profile: true },
    });

    this.emailService
      .sendWelcome({
        to: user.email,
        username: user.username,
        nickname: user.nickname ?? user.username,
      })
      .catch((err) => this.logger.warn('Welcome email failed:', err));

    return {
      user: this.usersService.toUserEntity(activatedUser),
      ...(await this.createSession(activatedUser)),
    };
  }

  async resendOtp(dto: { email: string }): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user || user.status !== 'PENDING_VERIFICATION') {
      return;
    }

    const lastOtp = await this.prisma.otpCode.findFirst({
      where: { userId: user.id, type: 'REGISTER_VERIFY', usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (lastOtp) {
      const secondsSinceCreation =
        (Date.now() - lastOtp.createdAt.getTime()) / 1000;
      if (secondsSinceCreation < OTP_RESEND_COOLDOWN) {
        const retryAfter = Math.ceil(
          OTP_RESEND_COOLDOWN - secondsSinceCreation,
        );
        throw new HttpException(
          { code: 'RESEND_COOLDOWN', retryAfter },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const plainCode = await this.otpService.create(user.id, 'REGISTER_VERIFY');
    await this.emailService.sendOtpVerification({
      to: user.email,
      username: user.username,
      code: plainCode,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user || !user.isActive) {
      return;
    }

    const lastOtp = await this.prisma.otpCode.findFirst({
      where: { userId: user.id, type: 'PASSWORD_RESET', usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (lastOtp) {
      const secondsSinceCreation =
        (Date.now() - lastOtp.createdAt.getTime()) / 1000;
      if (secondsSinceCreation < OTP_RESEND_COOLDOWN) {
        const retryAfter = Math.ceil(
          OTP_RESEND_COOLDOWN - secondsSinceCreation,
        );
        throw new HttpException(
          { code: 'RESEND_COOLDOWN', retryAfter },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const plainCode = await this.otpService.create(user.id, 'PASSWORD_RESET');

    const result = await this.emailService.sendPasswordResetOtp({
      to: user.email,
      username: user.username,
      code: plainCode,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });

    if (!result.success) {
      this.logger.warn(
        `Email de recuperacion no enviado para userId=${user.id}: ${result.error}`,
      );
    }
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new BadRequestException('Solicitud de restablecimiento invalida');
    }

    const result = await this.otpService.verify(
      user.id,
      dto.code,
      'PASSWORD_RESET',
    );

    if (!result.valid) {
      switch (result.reason) {
        case 'expired':
          throw new HttpException({ code: 'OTP_EXPIRED' }, HttpStatus.GONE);
        case 'too_many_attempts':
          throw new HttpException(
            { code: 'TOO_MANY_ATTEMPTS' },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        default:
          throw new BadRequestException({ code: 'OTP_INVALID' });
      }
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, this.saltRounds);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revoked: false },
      data: { revoked: true },
    });
  }

  async getOptionalJwtPayloadFromAuthHeader(
    authorization?: string,
  ): Promise<JwtPayload | null> {
    if (!authorization?.startsWith('Bearer ')) {
      return null;
    }

    const token = authorization.replace('Bearer ', '').trim();

    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });
    } catch {
      return null;
    }
  }

  private async createSession(user: SessionUser, family?: string) {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>(
        'JWT_EXPIRES_IN',
        '15m',
      ) as never,
    });

    const tokenFamily = family ?? crypto.randomUUID();
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>(
        'JWT_REFRESH_EXPIRES_IN',
        '7d',
      ) as never,
    });

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: user.id,
        family: tokenFamily,
        expiresAt: this.calculateExpiryDate(
          this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
        ),
      },
    });

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalido');
    }
  }

  private async findMatchingRefreshToken(
    rawToken: string,
    tokens: Array<{
      id: string;
      tokenHash: string;
      family: string;
      expiresAt: Date;
      revoked: boolean;
    }>,
  ) {
    for (const token of tokens) {
      if (token.revoked || token.expiresAt < new Date()) {
        continue;
      }

      const matches = await bcrypt.compare(rawToken, token.tokenHash);
      if (matches) {
        return token;
      }
    }

    return null;
  }

  private calculateExpiryDate(expiresIn: string): Date {
    const date = new Date();
    const amount = Number.parseInt(expiresIn, 10);

    if (expiresIn.endsWith('d')) {
      date.setDate(date.getDate() + amount);
      return date;
    }

    if (expiresIn.endsWith('h')) {
      date.setHours(date.getHours() + amount);
      return date;
    }

    if (expiresIn.endsWith('m')) {
      date.setMinutes(date.getMinutes() + amount);
      return date;
    }

    date.setSeconds(date.getSeconds() + amount);
    return date;
  }
}
