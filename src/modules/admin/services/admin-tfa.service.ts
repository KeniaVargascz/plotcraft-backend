import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TOTP, Secret } from 'otpauth';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../../prisma/prisma.service';
import { CacheService, CACHE_SERVICE } from '../../../common/services/cache.service';

const ISSUER = 'PlotCraft Admin';
const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_MAX_FAILURES = 5;
const TOTP_LOCKOUT_TTL_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class AdminTfaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  async generateSetup(userId: string): Promise<{ qrDataUrl: string; otpauthUrl: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, tfaEnabled: true },
    });

    if (user.tfaEnabled) {
      throw new BadRequestException({
        statusCode: 400,
        message: '2FA is already enabled',
        code: 'TFA_ALREADY_ENABLED',
      });
    }

    const secret = new Secret({ size: 20 });
    const totp = new TOTP({
      issuer: ISSUER,
      label: user.email,
      secret,
      period: TOTP_PERIOD,
      digits: TOTP_DIGITS,
    });

    const otpauthUrl = totp.toString();
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Store secret in DB (not enabled yet until verified)
    await this.prisma.user.update({
      where: { id: userId },
      data: { tfaSecret: secret.base32 },
    });

    // Return QR only — secret not exposed in response
    return { qrDataUrl, otpauthUrl };
  }

  async enableTfa(userId: string, code: string): Promise<{ enabled: boolean }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { tfaSecret: true, tfaEnabled: true, email: true },
    });

    if (user.tfaEnabled) {
      throw new BadRequestException({
        statusCode: 400,
        message: '2FA is already enabled',
        code: 'TFA_ALREADY_ENABLED',
      });
    }

    if (!user.tfaSecret) {
      throw new BadRequestException({
        statusCode: 400,
        message: '2FA setup not initiated',
        code: 'TFA_NOT_INITIATED',
      });
    }

    const valid = this.verifyCode(user.tfaSecret, code);
    if (!valid) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Invalid 2FA code',
        code: 'TFA_INVALID_CODE',
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { tfaEnabled: true },
    });

    return { enabled: true };
  }

  async disableTfa(userId: string, code: string): Promise<{ enabled: boolean }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { tfaSecret: true, tfaEnabled: true },
    });

    if (!user.tfaEnabled) {
      throw new BadRequestException({
        statusCode: 400,
        message: '2FA is not enabled',
        code: 'TFA_NOT_ENABLED',
      });
    }

    const valid = this.verifyCode(user.tfaSecret!, code);
    if (!valid) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Invalid 2FA code',
        code: 'TFA_INVALID_CODE',
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { tfaEnabled: false, tfaSecret: null },
    });

    return { enabled: false };
  }

  async verifyLogin(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { tfaSecret: true, tfaEnabled: true },
    });

    if (!user.tfaEnabled || !user.tfaSecret) {
      return true; // 2FA not enabled, skip
    }

    // Check lockout per user
    const failKey = `totp:failures:${userId}`;
    const failures = (await this.cache.get<number>(failKey)) ?? 0;
    if (failures >= TOTP_MAX_FAILURES) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Too many failed 2FA attempts. Try again later.',
        code: 'TFA_LOCKED',
      });
    }

    const valid = this.verifyCode(user.tfaSecret, code);
    if (!valid) {
      await this.cache.set(failKey, failures + 1, TOTP_LOCKOUT_TTL_MS);
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid 2FA code',
        code: 'TFA_INVALID_CODE',
      });
    }

    // Reset failures on success
    await this.cache.del(failKey);
    return true;
  }

  private verifyCode(secret: string, code: string): boolean {
    const totp = new TOTP({
      secret: Secret.fromBase32(secret),
      period: TOTP_PERIOD,
      digits: TOTP_DIGITS,
    });

    // Strict: only current 30-second window
    const delta = totp.validate({ token: code, window: 0 });
    return delta !== null;
  }
}
