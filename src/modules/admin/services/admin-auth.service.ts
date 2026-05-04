import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthService } from '../../auth/auth.service';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { AdminAuditService } from './admin-audit.service';
import { AdminTfaService } from './admin-tfa.service';
import { Role, hasRole } from '../../../common/constants/roles';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly auditService: AdminAuditService,
    private readonly tfaService: AdminTfaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: AdminLoginDto) {
    // Step 1: Validate credentials
    const result = await this.authService.login({
      identifier: dto.email,
      password: dto.password,
    });

    // Step 2: Verify admin status BEFORE creating any tokens
    const user = await this.prisma.user.findUnique({
      where: { id: result.user.id },
      select: { isAdmin: true, role: true, tfaEnabled: true },
    });

    if (!user || !hasRole(user.role, Role.MASTER)) {
      throw new UnauthorizedException({
        code: 'NOT_ADMIN',
        message: 'Access restricted to administrators.',
      });
    }

    // Step 3: Only after confirming admin, create temporary 2FA token
    const tfaToken = await this.jwtService.signAsync(
      { sub: result.user.id, email: result.user.email, purpose: 'tfa' },
      {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: '5m',
      },
    );

    if (user.tfaEnabled) {
      // 2FA configured — require code verification
      return { tfaRequired: true, tfaToken };
    }

    // 2FA NOT configured — require setup before full access
    const setupData = await this.tfaService.generateSetup(result.user.id);
    return {
      tfaSetupRequired: true,
      tfaToken,
      qrDataUrl: setupData.qrDataUrl,
    };
  }

  async verifyTfa(tfaToken: string, code: string) {
    let payload: { sub: string; email: string; purpose: string };
    try {
      payload = await this.jwtService.verifyAsync(tfaToken, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid or expired 2FA token',
        code: 'TFA_TOKEN_INVALID',
      });
    }

    if (payload.purpose !== 'tfa') {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid token purpose',
        code: 'TFA_TOKEN_INVALID',
      });
    }

    // Verify admin has 2FA enabled — prevents bypass via calling /tfa/verify
    // instead of /tfa/setup-and-enable when 2FA is not configured
    const adminUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
      select: { tfaEnabled: true },
    });

    if (!adminUser.tfaEnabled) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: '2FA setup required before login',
        code: 'TFA_SETUP_REQUIRED',
      });
    }

    // Verify the TOTP code
    await this.tfaService.verifyLogin(payload.sub, code);

    const result = await this.createSessionForUser(payload.sub);

    await this.auditService.log({
      adminId: payload.sub,
      adminEmail: payload.email,
      action: 'LOGIN_TFA',
      resourceType: 'auth',
    });

    return result;
  }

  async setupAndEnable(tfaToken: string, code: string, phone: string) {
    let payload: { sub: string; email: string; purpose: string };
    try {
      payload = await this.jwtService.verifyAsync(tfaToken, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid or expired 2FA token',
        code: 'TFA_TOKEN_INVALID',
      });
    }

    if (payload.purpose !== 'tfa') {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid token purpose',
        code: 'TFA_TOKEN_INVALID',
      });
    }

    const phoneRegex = /^\+[1-9]\d{7,14}$/; // E.164 format
    if (!phone || !phoneRegex.test(phone)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Valid phone number in E.164 format required (e.g. +521234567890)',
        code: 'PHONE_REQUIRED',
      });
    }

    // Enable 2FA and save phone in one step
    await this.tfaService.enableTfa(payload.sub, code);
    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { phone },
    });

    const result = await this.createSessionForUser(payload.sub);

    await this.auditService.log({
      adminId: payload.sub,
      adminEmail: payload.email,
      action: 'TFA_SETUP_COMPLETE',
      resourceType: 'auth',
      details: { phone },
    });

    return result;
  }

  private async createSessionForUser(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    });

    // Build the same response structure as AuthService.login
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
