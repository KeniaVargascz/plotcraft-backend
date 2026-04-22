import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { OtpType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CacheService,
  CACHE_SERVICE,
} from '../../common/services/cache.service';
import {
  OTP_EXPIRY_MINUTES,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
} from './otp.constants';

const OTP_ATTEMPTS_PREFIX = 'otp:attempts:';
const OTP_ATTEMPTS_TTL_MS = OTP_EXPIRY_MINUTES * 60 * 1000;

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  private generateCode(): string {
    return Array.from({ length: OTP_LENGTH }, () =>
      Math.floor(Math.random() * 10),
    ).join('');
  }

  async create(userId: string, type: OtpType): Promise<string> {
    const plainCode = this.generateCode();
    const hashedCode = await bcrypt.hash(plainCode, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.otpCode.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    });

    await this.prisma.otpCode.create({
      data: { userId, code: hashedCode, type, expiresAt },
    });

    return plainCode;
  }

  async verify(
    userId: string,
    plainCode: string,
    type: OtpType,
  ): Promise<
    | { valid: true }
    | {
        valid: false;
        reason: 'not_found' | 'expired' | 'invalid' | 'too_many_attempts';
      }
  > {
    const otpRecord = await this.prisma.otpCode.findFirst({
      where: { userId, type, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return { valid: false, reason: 'not_found' };
    }

    if (otpRecord.expiresAt < new Date()) {
      return { valid: false, reason: 'expired' };
    }

    const isMatch = await bcrypt.compare(plainCode, otpRecord.code);
    const cacheKey = `${OTP_ATTEMPTS_PREFIX}${otpRecord.id}`;

    if (!isMatch) {
      const attempts = ((await this.cache.get<number>(cacheKey)) ?? 0) + 1;
      await this.cache.set(cacheKey, attempts, OTP_ATTEMPTS_TTL_MS);

      if (attempts >= OTP_MAX_ATTEMPTS) {
        await this.prisma.otpCode.update({
          where: { id: otpRecord.id },
          data: { usedAt: new Date() },
        });
        await this.cache.del(cacheKey);
        return { valid: false, reason: 'too_many_attempts' };
      }

      return { valid: false, reason: 'invalid' };
    }

    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });

    await this.cache.del(cacheKey);
    return { valid: true };
  }
}
