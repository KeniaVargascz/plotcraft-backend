import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './strategies/jwt.strategy';
import { APP_CONFIG } from '../../config/constants';

type SessionUser = Prisma.UserGetPayload<{ include: { profile: true } }>;

@Injectable()
export class AuthService {
  private readonly saltRounds = APP_CONFIG.auth.saltRounds;

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const username = dto.username.trim();

    const duplicate = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (duplicate) {
      throw new ConflictException('El email o username ya estan registrados');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);
    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          username,
          passwordHash,
        },
      });

      await tx.profile.create({
        data: {
          userId: createdUser.id,
        },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: createdUser.id },
        include: { profile: true },
      });
    });

    return {
      user: this.usersService.toUserEntity(user),
      ...(await this.createSession(user)),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: { profile: true },
    });

    if (!user) {
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

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Credenciales incorrectas',
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

    const activeTokens = await this.prisma.refreshToken.findMany({
      where: { userId: user.id, revoked: false },
      orderBy: { createdAt: 'desc' },
    });

    const matchedToken = await this.findMatchingRefreshToken(
      dto.refreshToken,
      activeTokens,
    );
    if (!matchedToken) {
      throw new UnauthorizedException('Refresh token invalido');
    }

    await this.prisma.refreshToken.update({
      where: { id: matchedToken.id },
      data: { revoked: true },
    });

    return {
      user: this.usersService.toUserEntity(user),
      ...(await this.createSession(user)),
    };
  }

  async logout(userId: string, dto: RefreshTokenDto) {
    const activeTokens = await this.prisma.refreshToken.findMany({
      where: { userId, revoked: false },
    });

    const matchedToken = await this.findMatchingRefreshToken(
      dto.refreshToken,
      activeTokens,
    );
    if (!matchedToken) {
      throw new UnauthorizedException('Refresh token invalido');
    }

    await this.prisma.refreshToken.update({
      where: { id: matchedToken.id },
      data: { revoked: true },
    });

    return { message: 'Sesion cerrada correctamente' };
  }

  async me(userId: string) {
    return this.usersService.getCurrentUser(userId);
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

  private async createSession(user: SessionUser) {
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

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>(
        'JWT_REFRESH_EXPIRES_IN',
        '7d',
      ) as never,
    });

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: await bcrypt.hash(refreshToken, this.saltRounds),
        userId: user.id,
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
