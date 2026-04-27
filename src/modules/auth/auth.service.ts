import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { createHash } from 'crypto';
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
import {
  type JwtPayload,
  ACCESS_TOKEN_BLACKLIST_PREFIX,
} from './strategies/jwt.strategy';
import { APP_CONFIG } from '../../config/constants';
import {
  CacheService,
  CACHE_SERVICE,
} from '../../common/services/cache.service';
import { FeatureFlagCacheService } from '../../common/services/feature-flag-cache.service';

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
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
    private readonly featureFlagCache: FeatureFlagCacheService,
  ) {
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    if (refreshSecret.length < 32) {
      throw new Error(
        'JWT_REFRESH_SECRET must be at least 32 characters (256 bits minimum)',
      );
    }
  }

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
        message: 'Invalid credentials',
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_DISABLED',
        message: 'Your account is disabled. Contact support.',
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
        message: 'Invalid credentials',
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
        message: 'Invalid credentials',
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

    if (!user.isActive) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Account disabled',
        code: 'ACCOUNT_DISABLED',
      });
    }

    if (
      user.failedLoginAttempts >= APP_CONFIG.auth.maxFailedAttempts &&
      user.lockedUntil &&
      user.lockedUntil > new Date()
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Account locked',
        code: 'ACCOUNT_LOCKED',
      });
    }

    const flagsChanged =
      await this.featureFlagCache.getLastChangedTimestamp();
    if (flagsChanged && payload.iat && flagsChanged > payload.iat) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Session expired due to configuration change',
        code: 'FLAGS_CHANGED',
      });
    }

    // Fetch only non-expired, non-revoked tokens (limit to reduce bcrypt calls)
    const activeTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId: user.id,
        revoked: false,
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
        where: {
          userId: user.id,
          revoked: true,
          revokedAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { revokedAt: 'desc' },
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
      throw new UnauthorizedException({ statusCode: 401, message: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' });
    }

    // Atomic rotate: revoke current token only if still active (prevents race condition)
    const revoked = await this.prisma.refreshToken.updateMany({
      where: { id: matchedToken.id, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });

    // If another concurrent request already revoked it, reject this one
    if (revoked.count === 0) {
      throw new UnauthorizedException({ statusCode: 401, message: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' });
    }

    return {
      user: this.usersService.toUserEntity(user),
      ...(await this.createSession(user, matchedToken.family)),
    };
  }

  async logout(caller: JwtPayload, dto: RefreshTokenDto) {
    const activeTokens = await this.prisma.refreshToken.findMany({
      where: { userId: caller.sub, revoked: false, expiresAt: { gt: new Date() } },
      take: 10,
    });

    const matchedToken = await this.findMatchingRefreshToken(
      dto.refreshToken,
      activeTokens,
    );
    if (!matchedToken) {
      throw new UnauthorizedException({ statusCode: 401, message: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' });
    }

    // Revoke entire family on logout for maximum security
    await this.prisma.refreshToken.updateMany({
      where: { family: matchedToken.family },
      data: { revoked: true, revokedAt: new Date() },
    });

    // Blacklist the current access token until it expires
    if (caller.jti && caller.exp) {
      const remainingMs = Math.max(0, caller.exp * 1000 - Date.now());
      if (remainingMs > 0) {
        await this.cache.set(
          `${ACCESS_TOKEN_BLACKLIST_PREFIX}${caller.jti}`,
          true,
          remainingMs,
        );
      }
    }

    return { message: 'Session closed successfully' };
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
      throw new BadRequestException({ statusCode: 400, message: 'Invalid verification request', code: 'INVALID_VERIFICATION_REQUEST' });
    }

    const result = await this.otpService.verify(
      user.id,
      dto.code,
      'REGISTER_VERIFY',
    );

    if (!result.valid) {
      switch (result.reason) {
        case 'expired':
          throw new HttpException({ message: 'OTP code expired', code: 'OTP_EXPIRED' }, HttpStatus.GONE);
        case 'too_many_attempts':
          throw new HttpException(
            { message: 'Too many attempts', code: 'TOO_MANY_ATTEMPTS' },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        default:
          throw new BadRequestException({ message: 'Invalid OTP code', code: 'OTP_INVALID' });
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

    // Fire-and-forget: prevents timing-based user enumeration
    this.emailService.sendOtpVerification({
      to: user.email,
      username: user.username,
      code: plainCode,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    }).catch((err) => {
      this.logger.warn(`OTP email failed for userId=${user.id}: ${err}`);
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

    // Fire-and-forget: prevents timing-based user enumeration
    this.emailService.sendPasswordResetOtp({
      to: user.email,
      username: user.username,
      code: plainCode,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    }).then((result) => {
      if (!result.success) {
        this.logger.warn(
          `Password reset email not sent for userId=${user.id}: ${result.error}`,
        );
      }
    }).catch((err) => {
      this.logger.warn(`Password reset email failed for userId=${user.id}: ${err}`);
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new BadRequestException({ statusCode: 400, message: 'Invalid reset request', code: 'INVALID_RESET_REQUEST' });
    }

    const result = await this.otpService.verify(
      user.id,
      dto.code,
      'PASSWORD_RESET',
    );

    if (!result.valid) {
      switch (result.reason) {
        case 'expired':
          throw new HttpException({ message: 'OTP code expired', code: 'OTP_EXPIRED' }, HttpStatus.GONE);
        case 'too_many_attempts':
          throw new HttpException(
            { message: 'Too many attempts', code: 'TOO_MANY_ATTEMPTS' },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        default:
          throw new BadRequestException({ message: 'Invalid OTP code', code: 'OTP_INVALID' });
      }
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, this.saltRounds);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    await this.invalidateAllSessions(user.id);

    this.logger.warn(
      `Password reset for user ${user.id} — all sessions invalidated`,
    );
  }

  async logoutAllDevices(userId: string): Promise<void> {
    await this.invalidateAllSessions(userId);
    this.logger.warn(`User ${userId} logged out from all devices`);
  }

  private async invalidateAllSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });

    // User-level blacklist: store the timestamp so only tokens issued BEFORE
    // this moment are rejected. Tokens issued after (new logins) pass through.
    await this.cache.set(
      `blacklist:user:${userId}`,
      Math.floor(Date.now() / 1000),
      60 * 60 * 1000, // 60 min (access token max lifetime)
    );
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
      jti: crypto.randomUUID(),
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>(
        'JWT_EXPIRES_IN',
        APP_CONFIG.auth.accessTokenTtl,
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

    // SHA-256 pre-hash: bcrypt truncates at 72 bytes, JWTs share the same first 72 bytes
    // for the same user. SHA-256 produces a unique 64-char hex digest that fits within bcrypt's limit.
    const tokenDigest = createHash('sha256').update(refreshToken).digest('hex');
    const tokenHash = await bcrypt.hash(tokenDigest, 10);
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
      throw new UnauthorizedException({ statusCode: 401, message: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' });
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
    // SHA-256 pre-hash to match the hashing used in createSession
    const tokenDigest = createHash('sha256').update(rawToken).digest('hex');

    for (const token of tokens) {
      if (token.revoked || token.expiresAt < new Date()) {
        continue;
      }

      const matches = await bcrypt.compare(tokenDigest, token.tokenHash);
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
